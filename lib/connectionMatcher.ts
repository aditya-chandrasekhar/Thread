import { Db, ObjectId } from "mongodb";
import { COLLECTIONS, VECTOR_INDEX_NAME } from "./mongodb";
import { embeddingsAvailable } from "./embeddings";
import { chatJSON, openRouterAvailable } from "./openrouter";
import type { ConnectionDoc, MemoryDoc, PersonDoc } from "./types";
import { z } from "zod";

/**
 * Cross-person need ↔ offer matching — the heart of Thread.
 *
 * When a new `need` memory arrives, we search existing `offer` memories from
 * OTHER people (and vice versa). Engines, in order of preference:
 *
 *   1. "vector"  — MongoDB Atlas Vector Search over memories.embedding
 *   2. "llm"     — OpenRouter judges candidate pairs semantically
 *   3. "keyword" — deterministic token-overlap fallback (dev/demo safety net)
 *
 * The active engine is reported on each connection and surfaced in the UI.
 */

export interface MatchCandidate {
  memory: MemoryDoc;
  score: number;
  engine: ConnectionDoc["engine"];
}

const OPPOSITE: Record<string, "need" | "offer"> = { need: "offer", offer: "need" };

export async function findRelevantConnections(
  db: Db,
  newMemories: MemoryDoc[],
  person: PersonDoc,
  sessionId: string
): Promise<{ newMemory: MemoryDoc; match: MatchCandidate }[]> {
  const results: { newMemory: MemoryDoc; match: MatchCandidate }[] = [];

  for (const mem of newMemories) {
    if (mem.type !== "need" && mem.type !== "offer") continue;
    const targetType = OPPOSITE[mem.type];

    let matches: MatchCandidate[] = [];

    // 1. Atlas Vector Search
    if (embeddingsAvailable() && mem.embedding && mem.embedding.length > 0) {
      try {
        matches = await vectorMatch(db, mem, targetType, sessionId, person._id!);
      } catch (err) {
        console.error("Vector search unavailable, falling back:", err);
      }
    }

    // 2 & 3. Fallbacks over plain candidates
    if (matches.length === 0) {
      const candidates = (await db
        .collection<MemoryDoc>(COLLECTIONS.memories)
        .find({
          sessionId,
          type: targetType,
          personId: { $ne: person._id },
        })
        .sort({ createdAt: -1 })
        .limit(25)
        .toArray()) as MemoryDoc[];

      if (candidates.length > 0) {
        if (openRouterAvailable()) {
          try {
            matches = await llmMatch(mem, candidates);
          } catch (err) {
            console.error("LLM matching failed, using keyword fallback:", err);
            matches = keywordMatch(mem, candidates);
          }
        } else {
          matches = keywordMatch(mem, candidates);
        }
      }
    }

    // keep only the strongest match per new memory
    const best = matches.sort((a, b) => b.score - a.score)[0];
    if (best) results.push({ newMemory: mem, match: best });
  }

  return results;
}

// ---------- Engine 1: Atlas Vector Search ----------

async function vectorMatch(
  db: Db,
  mem: MemoryDoc,
  targetType: "need" | "offer",
  sessionId: string,
  excludePersonId: ObjectId
): Promise<MatchCandidate[]> {
  const docs = (await db
    .collection(COLLECTIONS.memories)
    .aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: "embedding",
          queryVector: mem.embedding,
          numCandidates: 100,
          limit: 8,
          filter: { type: { $eq: targetType }, sessionId: { $eq: sessionId } },
        },
      },
      { $addFields: { score: { $meta: "vectorSearchScore" } } },
    ])
    .toArray()) as (MemoryDoc & { score: number })[];

  return docs
    .filter((d) => !d.personId.equals(excludePersonId) && d.score >= 0.7)
    .map((d) => ({ memory: d, score: Math.round(d.score * 100) / 100, engine: "vector" as const }));
}

// ---------- Engine 2: LLM semantic judge ----------

const LlmMatchSchema = z.object({
  matches: z
    .array(z.object({ id: z.string(), score: z.coerce.number().min(0).max(1) }))
    .default([]),
});

async function llmMatch(mem: MemoryDoc, candidates: MemoryDoc[]): Promise<MatchCandidate[]> {
  const list = candidates
    .map((c, i) => `${i}. [id=${c._id!.toHexString()}] ${c.text}`)
    .join("\n");
  const raw = await chatJSON({
    system: `You match needs with offers between people in a professional network. Given a new memory and candidate memories from OTHER people, return which candidates genuinely address the new memory. Only real, specific matches (same domain/skill) — no stretches. Respond ONLY with JSON: {"matches": [{"id": string, "score": number between 0 and 1}]}. Empty array if none.`,
    user: `New memory (type=${mem.type}): "${mem.text}"\n\nCandidates (type=${OPPOSITE[mem.type]}):\n${list}`,
    maxTokens: 400,
  });
  const parsed = LlmMatchSchema.parse(raw);
  const byId = new Map(candidates.map((c) => [c._id!.toHexString(), c]));
  return parsed.matches
    .filter((m) => m.score >= 0.6 && byId.has(m.id))
    .map((m) => ({ memory: byId.get(m.id)!, score: m.score, engine: "llm" as const }));
}

// ---------- Engine 3: deterministic keyword overlap ----------

const STOPWORDS = new Set(
  "a an the and or but with for from into your our their his her its i you they we is are was be been being has have had do does did will would could should might can may of in on at to by as it this that someone somebody people person meet meeting help needs need offer offers works working work knows know well really right now lot more building build builds trouble".split(
    " "
  )
);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

export function keywordMatch(mem: MemoryDoc, candidates: MemoryDoc[]): MatchCandidate[] {
  const a = tokens(mem.text);
  const out: MatchCandidate[] = [];
  for (const c of candidates) {
    const b = tokens(c.text);
    let overlap = 0;
    for (const t of a) if (b.has(t)) overlap++;
    if (overlap >= 2) {
      out.push({
        memory: c,
        score: Math.min(0.95, 0.5 + overlap * 0.15),
        engine: "keyword",
      });
    }
  }
  return out;
}

// ---------- Reason phrasing ----------

export async function phraseConnectionReason(
  needText: string,
  needPersonName: string,
  offerText: string,
  offerPersonName: string
): Promise<string> {
  if (openRouterAvailable()) {
    try {
      const raw = (await chatJSON({
        system: `Write one short, natural sentence explaining why two people should be introduced, based on a need and an offer. Style: "Daniel works on exactly the vector-search problem Maya mentioned." No preamble. Respond ONLY with JSON: {"reason": string}.`,
        user: `${needPersonName}'s need: "${needText}"\n${offerPersonName}'s offer: "${offerText}"`,
        maxTokens: 120,
      })) as { reason?: string };
      if (raw?.reason && typeof raw.reason === "string") return raw.reason;
    } catch {
      /* fall through to template */
    }
  }
  return `${offerPersonName} works on exactly what ${needPersonName} needs — ${needText
    .replace(/^.*?needs\s*/i, "")
    .replace(/\.$/, "")}.`;
}
