import { Db, MongoClient } from "mongodb";

const DB_NAME = process.env.MONGODB_DB || "thread";

// Every document is scoped to a session so "Reset demo" only wipes demo data.
export const SESSION_ID = process.env.DEMO_SESSION_ID || "demo";

declare global {
  var _threadMongo: Promise<MongoClient> | undefined;
}

function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local — Thread needs MongoDB Atlas as its persistent memory store."
    );
  }
  if (!global._threadMongo) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 6000 });
    global._threadMongo = client.connect().catch((err) => {
      // Don't poison the cache with a rejected promise — drop it so the
      // next request retries the connection instead of failing instantly
      // until the server restarts.
      global._threadMongo = undefined;
      client.close().catch(() => {});
      throw err;
    });
  }
  return global._threadMongo;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(DB_NAME);
}

export async function pingMongo(): Promise<boolean> {
  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}

export const COLLECTIONS = {
  people: "people",
  encounters: "encounters",
  memories: "memories",
  openLoops: "openLoops",
  connections: "connections",
} as const;

export const VECTOR_INDEX_NAME = "memory_vectors";
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Best-effort creation of the Atlas Vector Search index on memories.embedding.
 * Safe to call repeatedly; fails silently on non-Atlas deployments (the
 * connection matcher then falls back to LLM/keyword matching).
 */
export async function ensureVectorIndex(): Promise<"exists" | "created" | "unavailable"> {
  try {
    const db = await getDb();
    const coll = db.collection(COLLECTIONS.memories);
    const existing = await coll.listSearchIndexes().toArray();
    if (existing.some((i) => i.name === VECTOR_INDEX_NAME)) return "exists";
    await coll.createSearchIndex({
      name: VECTOR_INDEX_NAME,
      type: "vectorSearch",
      definition: {
        fields: [
          {
            type: "vector",
            path: "embedding",
            numDimensions: EMBEDDING_DIMENSIONS,
            similarity: "cosine",
          },
          { type: "filter", path: "type" },
          { type: "filter", path: "sessionId" },
          { type: "filter", path: "personId" },
        ],
      },
    });
    return "created";
  } catch {
    return "unavailable";
  }
}
