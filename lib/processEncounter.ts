import { Db, ObjectId } from "mongodb";
import { COLLECTIONS, SESSION_ID } from "./mongodb";
import { extractMemories } from "./memoryExtraction";
import { embedTexts, embeddingsAvailable } from "./embeddings";
import { findRelevantConnections, phraseConnectionReason } from "./connectionMatcher";
import { existingContextFor } from "./people";
import { identifyPersonName } from "./identify";
import type {
  ConnectionDoc,
  EncounterDoc,
  MemoryDoc,
  NewConnectionInfo,
  OpenLoopDoc,
  PersonDoc,
  ProcessResult,
} from "./types";

/**
 * The full pipeline for "encounter ended":
 * transcript → LLM extraction → memories + open loops in MongoDB →
 * cross-person need/offer matching → persisted connections.
 */
export async function processEncounter(
  db: Db,
  opts: { personId?: string | null; transcript: string; startedAt?: string }
): Promise<ProcessResult> {
  const { transcript } = opts;

  const { person, identified } = await resolvePerson(db, opts.personId, transcript);
  const _personId = person._id!;

  const existingContext = await existingContextFor(db, SESSION_ID, _personId);
  const { result: extraction, engine } = await extractMemories({
    transcript,
    personName: person.name,
    existingContext: existingContext || undefined,
  });

  const now = new Date();
  const startedAt = opts.startedAt ? new Date(opts.startedAt) : now;

  const encounter: EncounterDoc = {
    sessionId: SESSION_ID,
    personId: _personId,
    startedAt,
    endedAt: now,
    transcript,
    summary: extraction.summary,
    createdAt: now,
  };
  const encRes = await db.collection<EncounterDoc>(COLLECTIONS.encounters).insertOne(encounter);
  const encounterId = encRes.insertedId;

  // Build memory docs; embed for Atlas Vector Search when a provider is configured.
  const memoryDocs: MemoryDoc[] = extraction.memories.map((m) => ({
    sessionId: SESSION_ID,
    personId: _personId,
    encounterId,
    type: m.type,
    text: m.text,
    sourceText: m.sourceText,
    importance: m.importance,
    createdAt: now,
  }));

  if (memoryDocs.length > 0 && embeddingsAvailable()) {
    try {
      const vectors = await embedTexts(memoryDocs.map((m) => m.text));
      vectors.forEach((v, i) => (memoryDocs[i].embedding = v));
    } catch (err) {
      console.error("Embedding failed (continuing without vectors):", err);
    }
  }

  if (memoryDocs.length > 0) {
    const memRes = await db.collection<MemoryDoc>(COLLECTIONS.memories).insertMany(memoryDocs);
    memoryDocs.forEach((m, i) => (m._id = memRes.insertedIds[i]));
  }

  // Commitments become open loops.
  const loopDocs: OpenLoopDoc[] = memoryDocs
    .filter((m) => m.type === "commitment_user_to_person" || m.type === "commitment_person_to_user")
    .map((m) => ({
      sessionId: SESSION_ID,
      personId: _personId,
      description: m.text,
      owner: m.type === "commitment_user_to_person" ? ("user" as const) : ("person" as const),
      status: "open" as const,
      createdAt: now,
      completedAt: null,
    }));
  if (loopDocs.length > 0) {
    await db.collection<OpenLoopDoc>(COLLECTIONS.openLoops).insertMany(loopDocs);
  }

  // Update the person profile (this stamps lastEncounterAt — the briefing reads
  // the previous value at request time, before any new encounter is processed).
  const interests = extraction.memories.filter((m) => m.type === "interest").map((m) => m.text);
  await db.collection<PersonDoc>(COLLECTIONS.people).updateOne(
    { _id: _personId },
    {
      $set: {
        updatedAt: now,
        lastEncounterAt: now,
        ...(extraction.shortDescription ? { shortDescription: extraction.shortDescription } : {}),
      },
      ...(interests.length > 0 ? { $addToSet: { interests: { $each: interests } } } : {}),
    }
  );

  // Cross-person need ↔ offer matching — the heart of Thread.
  const newConnections = await persistConnections(db, memoryDocs, person);

  return {
    personId: _personId.toHexString(),
    personName: person.name,
    memoriesSaved: memoryDocs.length,
    openLoopsCreated: loopDocs.length,
    summary: extraction.summary,
    memories: memoryDocs.map((m) => ({ type: m.type, text: m.text })),
    newConnections,
    extractionEngine: engine,
    identified,
  };
}

/**
 * Resolve who this encounter is with. An explicit personId wins; otherwise
 * the name is lifted from the conversation itself, matched case-insensitively
 * against people already in memory, or a new person is created.
 */
async function resolvePerson(
  db: Db,
  personId: string | null | undefined,
  transcript: string
): Promise<{ person: PersonDoc; identified: ProcessResult["identified"] }> {
  const people = db.collection<PersonDoc>(COLLECTIONS.people);

  if (personId) {
    if (!ObjectId.isValid(personId)) throw new Error("Invalid personId");
    const person = await people.findOne({ _id: new ObjectId(personId), sessionId: SESSION_ID });
    if (!person) throw new Error("Person not found");
    return { person, identified: "provided" };
  }

  const name = (await identifyPersonName(transcript)) ?? "Someone new";

  const existing = await people.findOne({
    sessionId: SESSION_ID,
    name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (existing) return { person: existing, identified: "existing" };

  const now = new Date();
  const doc: PersonDoc = {
    sessionId: SESSION_ID,
    name,
    shortDescription: "",
    interests: [],
    createdAt: now,
    updatedAt: now,
    firstMetAt: now,
    lastEncounterAt: null,
  };
  const res = await people.insertOne(doc);
  doc._id = res.insertedId;
  return { person: doc, identified: "created" };
}

async function persistConnections(
  db: Db,
  newMemories: MemoryDoc[],
  person: PersonDoc
): Promise<NewConnectionInfo[]> {
  const matches = await findRelevantConnections(db, newMemories, person, SESSION_ID);
  const out: NewConnectionInfo[] = [];

  for (const { newMemory, match } of matches) {
    const otherPersonId = match.memory.personId;
    const other = await db
      .collection<PersonDoc>(COLLECTIONS.people)
      .findOne({ _id: otherPersonId, sessionId: SESSION_ID });
    if (!other) continue;

    // Need side is always personA, offer side personB.
    const needFirst = newMemory.type === "need";
    const personA = needFirst ? person : other;
    const personB = needFirst ? other : person;
    const needMem = needFirst ? newMemory : match.memory;
    const offerMem = needFirst ? match.memory : newMemory;

    // One connection per pair per session — don't re-announce.
    const dup = await db.collection<ConnectionDoc>(COLLECTIONS.connections).findOne({
      sessionId: SESSION_ID,
      $or: [
        { personAId: personA._id, personBId: personB._id },
        { personAId: personB._id, personBId: personA._id },
      ],
    });
    if (dup) continue;

    const reason = await phraseConnectionReason(
      needMem.text,
      personA.name,
      offerMem.text,
      personB.name
    );

    const doc: ConnectionDoc = {
      sessionId: SESSION_ID,
      personAId: personA._id!,
      personBId: personB._id!,
      reason,
      score: match.score,
      engine: match.engine,
      triggerMemoryIds: [needMem._id!, offerMem._id!].filter(Boolean),
      createdAt: new Date(),
      status: "new",
    };
    const res = await db.collection<ConnectionDoc>(COLLECTIONS.connections).insertOne(doc);

    out.push({
      id: res.insertedId.toHexString(),
      personAName: personA.name,
      personBName: personB.name,
      reason,
      score: match.score,
      engine: match.engine,
    });
  }

  return out;
}
