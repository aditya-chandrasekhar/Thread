/**
 * Embedding provider for Atlas Vector Search.
 *
 * Configurable via env — any OpenAI-compatible embeddings endpoint works:
 *   EMBEDDINGS_API_KEY   (falls back to OPENAI_API_KEY)
 *   EMBEDDINGS_BASE_URL  (default https://api.openai.com/v1)
 *   EMBEDDINGS_MODEL     (default text-embedding-3-small, 1536 dims)
 *
 * If no key is configured, embeddings are skipped and the connection
 * matcher falls back to LLM/keyword matching (clearly surfaced in the UI).
 */

export function embeddingsAvailable(): boolean {
  return Boolean(process.env.EMBEDDINGS_API_KEY || process.env.OPENAI_API_KEY);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.EMBEDDINGS_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("No embeddings API key configured");
  const baseUrl = (process.env.EMBEDDINGS_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.EMBEDDINGS_MODEL || "text-embedding-3-small";

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Embeddings error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
