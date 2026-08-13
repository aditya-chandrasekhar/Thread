import { Db, ObjectId } from "mongodb";
import { COLLECTIONS, SESSION_ID } from "./mongodb";
import { serializePerson } from "./people";
import type {
  BriefingConnection,
  ConnectionDoc,
  MemoryDoc,
  OpenLoopDoc,
  PersonDoc,
  ReturnBriefing,
} from "./types";

/**
 * Pure briefing composition — everything time-sensitive happens here so it can
 * be unit-tested without a database.
 *
 * The core proof of persistent context: `newSinceLastSpoke` is computed from
 * connections created AFTER this person's previous encounter — events that
 * happened in the world while they were away, not fields on their profile.
 */
export function composeBriefing(inputs: {
  person: PersonDoc;
  memories: MemoryDoc[];
  openLoops: OpenLoopDoc[];
  connections: ConnectionDoc[];
  peopleById: Map<string, PersonDoc>;
}): ReturnBriefing {
  const { person, memories, openLoops, connections, peopleById } = inputs;
  const lastEncounterAt = person.lastEncounterAt;

  const lastTime = memories
    .filter((m) => m.type !== "commitment_user_to_person" && m.type !== "commitment_person_to_user")
    .sort((a, b) => b.importance - a.importance || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 4)
    .map((m) => m.text);

  const loops = openLoops
    .filter((l) => l.status === "open")
    .map((l) => ({ description: l.description, owner: l.owner }));

  const personKey = person._id!.toHexString();
  const newSinceLastSpoke: BriefingConnection[] = connections
    .filter((c) => {
      const involvesPerson =
        c.personAId.toHexString() === personKey || c.personBId.toHexString() === personKey;
      const isNew = !lastEncounterAt || c.createdAt.getTime() > lastEncounterAt.getTime();
      return involvesPerson && isNew;
    })
    .map((c) => {
      const otherId =
        c.personAId.toHexString() === personKey ? c.personBId.toHexString() : c.personAId.toHexString();
      const other = peopleById.get(otherId);
      return {
        withPersonName: other?.name ?? "Someone you met",
        reason: c.reason,
        createdAt: c.createdAt.toISOString(),
      };
    });

  const firstConnection = newSinceLastSpoke[0];
  const userLoop = loops.find((l) => l.owner === "user");

  const suggestedAction = firstConnection
    ? `Introduce ${person.name} to ${firstConnection.withPersonName}`
    : userLoop
      ? `Close the loop: ${userLoop.description}`
      : null;

  const suggestedOpener = firstConnection
    ? "I actually just met someone you should talk to."
    : userLoop
      ? "Before I forget — I owe you something."
      : null;

  const spokenParts: string[] = [];
  spokenParts.push(
    `${person.name}${person.shortDescription ? ` — ${person.shortDescription.toLowerCase()}` : ""}.`
  );
  if (userLoop) spokenParts.push(`You still owe them: ${stripName(userLoop.description)}`);
  for (const c of newSinceLastSpoke.slice(0, 2)) {
    spokenParts.push(`Since you last spoke, you met ${c.withPersonName}. ${c.reason}`);
  }
  if (suggestedAction) spokenParts.push(`Best next move: ${suggestedAction}.`);

  return {
    person: serializePerson(person),
    lastTime,
    openLoops: loops,
    newSinceLastSpoke,
    suggestedAction,
    suggestedOpener,
    spokenBriefing: spokenParts.join(" "),
    lastEncounterAt: lastEncounterAt ? lastEncounterAt.toISOString() : null,
  };
}

function stripName(text: string): string {
  return text.replace(/^you (promised|owe) (to )?/i, "").trim();
}

export async function getReturnBriefing(db: Db, personId: string): Promise<ReturnBriefing | null> {
  if (!ObjectId.isValid(personId)) return null;
  const _id = new ObjectId(personId);

  const person = await db
    .collection<PersonDoc>(COLLECTIONS.people)
    .findOne({ _id, sessionId: SESSION_ID });
  if (!person) return null;

  const [memories, openLoops, connections] = await Promise.all([
    db
      .collection<MemoryDoc>(COLLECTIONS.memories)
      .find({ sessionId: SESSION_ID, personId: _id })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray(),
    db
      .collection<OpenLoopDoc>(COLLECTIONS.openLoops)
      .find({ sessionId: SESSION_ID, personId: _id, status: "open" })
      .toArray(),
    db
      .collection<ConnectionDoc>(COLLECTIONS.connections)
      .find({ sessionId: SESSION_ID, $or: [{ personAId: _id }, { personBId: _id }] })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray(),
  ]);

  const otherIds = new Set<string>();
  for (const c of connections) {
    otherIds.add(c.personAId.toHexString());
    otherIds.add(c.personBId.toHexString());
  }
  const others = await db
    .collection<PersonDoc>(COLLECTIONS.people)
    .find({ sessionId: SESSION_ID, _id: { $in: [...otherIds].map((s) => new ObjectId(s)) } })
    .toArray();
  const peopleById = new Map(others.map((p) => [p._id!.toHexString(), p]));

  return composeBriefing({ person, memories, openLoops, connections, peopleById });
}
