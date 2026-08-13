import { Db, ObjectId } from "mongodb";
import { COLLECTIONS } from "./mongodb";
import type { MemoryDoc, PersonDoc, PersonLite } from "./types";

export function serializePerson(doc: PersonDoc): PersonLite {
  return {
    id: doc._id!.toHexString(),
    name: doc.name,
    shortDescription: doc.shortDescription,
    lastEncounterAt: doc.lastEncounterAt ? doc.lastEncounterAt.toISOString() : null,
  };
}

export async function listPeople(db: Db, sessionId: string): Promise<PersonLite[]> {
  const docs = await db
    .collection<PersonDoc>(COLLECTIONS.people)
    .find({ sessionId })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();
  return docs.map(serializePerson);
}

export async function createPerson(db: Db, sessionId: string, name: string): Promise<PersonLite> {
  const now = new Date();
  const doc: PersonDoc = {
    sessionId,
    name: name.trim(),
    shortDescription: "",
    interests: [],
    createdAt: now,
    updatedAt: now,
    firstMetAt: now,
    lastEncounterAt: null,
  };
  const res = await db.collection<PersonDoc>(COLLECTIONS.people).insertOne(doc);
  doc._id = res.insertedId;
  return serializePerson(doc);
}

export async function getPerson(db: Db, sessionId: string, id: string): Promise<PersonDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  return db
    .collection<PersonDoc>(COLLECTIONS.people)
    .findOne({ _id: new ObjectId(id), sessionId });
}

/** Short digest of what we already know — passed to the extractor to avoid duplicates. */
export async function existingContextFor(
  db: Db,
  sessionId: string,
  personId: ObjectId
): Promise<string> {
  const memories = await db
    .collection<MemoryDoc>(COLLECTIONS.memories)
    .find({ sessionId, personId })
    .sort({ importance: -1, createdAt: -1 })
    .limit(10)
    .toArray();
  return memories.map((m) => `[${m.type}] ${m.text}`).join(" | ");
}

/** Forget a person entirely: person, encounters, memories, loops, connections. */
export async function forgetPerson(db: Db, sessionId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const _id = new ObjectId(id);
  await Promise.all([
    db.collection(COLLECTIONS.memories).deleteMany({ sessionId, personId: _id }),
    db.collection(COLLECTIONS.encounters).deleteMany({ sessionId, personId: _id }),
    db.collection(COLLECTIONS.openLoops).deleteMany({ sessionId, personId: _id }),
    db.collection(COLLECTIONS.connections).deleteMany({
      sessionId,
      $or: [{ personAId: _id }, { personBId: _id }],
    }),
  ]);
  const res = await db.collection(COLLECTIONS.people).deleteOne({ sessionId, _id });
  return res.deletedCount === 1;
}
