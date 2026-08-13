import { ObjectId } from "mongodb";
import { COLLECTIONS, getDb, SESSION_ID } from "@/lib/mongodb";
import type { ConnectionDoc, PersonDoc } from "@/lib/types";

export async function GET() {
  try {
    const db = await getDb();
    const connections = await db
      .collection<ConnectionDoc>(COLLECTIONS.connections)
      .find({ sessionId: SESSION_ID })
      .sort({ createdAt: -1 })
      .limit(20)
      .toArray();

    const ids = [...new Set(connections.flatMap((c) => [c.personAId, c.personBId]))];
    const people = await db
      .collection<PersonDoc>(COLLECTIONS.people)
      .find({ sessionId: SESSION_ID, _id: { $in: ids } })
      .toArray();
    const nameOf = new Map(people.map((p) => [p._id!.toHexString(), p.name]));

    return Response.json({
      connections: connections.map((c) => ({
        id: c._id!.toHexString(),
        personAName: nameOf.get(c.personAId.toHexString()) ?? "Unknown",
        personBName: nameOf.get(c.personBId.toHexString()) ?? "Unknown",
        reason: c.reason,
        score: c.score,
        engine: c.engine,
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

/** Acknowledge a connection ("Remember for next time"). */
export async function PATCH(request: Request) {
  try {
    const { id } = (await request.json()) as { id?: string };
    if (!id || !ObjectId.isValid(id)) {
      return Response.json({ error: "Valid id is required" }, { status: 400 });
    }
    const db = await getDb();
    await db
      .collection<ConnectionDoc>(COLLECTIONS.connections)
      .updateOne({ _id: new ObjectId(id), sessionId: SESSION_ID }, { $set: { status: "acknowledged" } });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
