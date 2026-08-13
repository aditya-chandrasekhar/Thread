import { COLLECTIONS, getDb, SESSION_ID } from "@/lib/mongodb";
import type { ConnectionDoc, MemoryDoc, OpenLoopDoc, PersonDoc } from "@/lib/types";

/**
 * The global "Threads" surface: everything you're currently holding across
 * ALL people — open promises, unmatched needs/offers, and discovered
 * connections. One read over the whole persistent world model.
 */
export async function GET() {
  try {
    const db = await getDb();

    const [people, loops, connections, needsOffers] = await Promise.all([
      db.collection<PersonDoc>(COLLECTIONS.people).find({ sessionId: SESSION_ID }).toArray(),
      db
        .collection<OpenLoopDoc>(COLLECTIONS.openLoops)
        .find({ sessionId: SESSION_ID, status: "open" })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray(),
      db
        .collection<ConnectionDoc>(COLLECTIONS.connections)
        .find({ sessionId: SESSION_ID })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
      db
        .collection<MemoryDoc>(COLLECTIONS.memories)
        .find({ sessionId: SESSION_ID, type: { $in: ["need", "offer"] } })
        .sort({ importance: -1, createdAt: -1 })
        .limit(20)
        .toArray(),
    ]);

    const nameOf = new Map(people.map((p) => [p._id!.toHexString(), p.name]));
    const matchedMemoryIds = new Set(
      connections.flatMap((c) => c.triggerMemoryIds.map((id) => id.toHexString()))
    );

    return Response.json({
      threads: {
        peopleCount: people.length,
        openLoops: loops.map((l) => ({
          id: l._id!.toHexString(),
          personName: nameOf.get(l.personId.toHexString()) ?? "Someone",
          description: l.description,
          owner: l.owner,
        })),
        // needs/offers still waiting for their other half
        unmatched: needsOffers
          .filter((m) => !matchedMemoryIds.has(m._id!.toHexString()))
          .slice(0, 8)
          .map((m) => ({
            personName: nameOf.get(m.personId.toHexString()) ?? "Someone",
            type: m.type,
            text: m.text,
          })),
        connections: connections.map((c) => ({
          id: c._id!.toHexString(),
          personAName: nameOf.get(c.personAId.toHexString()) ?? "Someone",
          personBName: nameOf.get(c.personBId.toHexString()) ?? "Someone",
          reason: c.reason,
          engine: c.engine,
        })),
      },
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
