import { pingMongo, ensureVectorIndex } from "@/lib/mongodb";
import { elevenLabsAvailable } from "@/lib/elevenlabs";
import { openRouterAvailable } from "@/lib/openrouter";
import { embeddingsAvailable } from "@/lib/embeddings";

export async function GET() {
  const mongo = await pingMongo();
  let vectorIndex: "exists" | "created" | "unavailable" = "unavailable";
  if (mongo && embeddingsAvailable()) {
    vectorIndex = await ensureVectorIndex();
  }
  return Response.json({
    mongo,
    elevenlabs: elevenLabsAvailable(),
    openrouter: openRouterAvailable(),
    embeddings: embeddingsAvailable(),
    vectorIndex,
    matchEngine:
      embeddingsAvailable() && vectorIndex !== "unavailable"
        ? "vector"
        : openRouterAvailable()
          ? "llm"
          : "keyword",
  });
}
