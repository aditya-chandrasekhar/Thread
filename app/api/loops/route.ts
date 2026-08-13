import { ObjectId } from "mongodb";
import { COLLECTIONS, getDb, SESSION_ID } from "@/lib/mongodb";
import type { OpenLoopDoc } from "@/lib/types";

/** Close (or reopen) an open loop — "I sent Maya the paper." */
export async function PATCH(request: Request) {
  try {
    const { id, status } = (await request.json()) as { id?: string; status?: "open" | "completed" };
    if (!id || !ObjectId.isValid(id) || !status) {
      return Response.json({ error: "Valid id and status are required" }, { status: 400 });
    }
    const res = await (await getDb()).collection<OpenLoopDoc>(COLLECTIONS.openLoops).updateOne(
      { _id: new ObjectId(id), sessionId: SESSION_ID },
      { $set: { status, completedAt: status === "completed" ? new Date() : null } }
    );
    if (res.matchedCount === 0) return Response.json({ error: "Loop not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      { status: 500 }
    );
  }
}
