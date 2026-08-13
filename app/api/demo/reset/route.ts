import { COLLECTIONS, getDb, SESSION_ID, ensureVectorIndex } from "@/lib/mongodb";
import { embeddingsAvailable } from "@/lib/embeddings";

/**
 * Clears ONLY documents belonging to the demo session — every document in
 * every collection is scoped by sessionId, so this never touches other data.
 */
export async function POST() {
  try {
    const db = await getDb();
    await Promise.all(
      Object.values(COLLECTIONS).map((name) =>
        db.collection(name).deleteMany({ sessionId: SESSION_ID })
      )
    );
    if (embeddingsAvailable()) {
      // Best-effort: make sure the vector index exists for the fresh run.
      ensureVectorIndex().catch(() => {});
    }
    return Response.json({ reset: true, sessionId: SESSION_ID });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Reset failed" },
      { status: 500 }
    );
  }
}
