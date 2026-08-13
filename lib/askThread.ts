import { Db } from "mongodb";
import { z } from "zod";
import { COLLECTIONS, SESSION_ID } from "./mongodb";
import { chatJSON, openRouterAvailable } from "./openrouter";
import type { ConnectionDoc, MemoryDoc, OpenLoopDoc, PersonDoc } from "./types";

const AnswerSchema = z.object({ answer: z.string().min(1) });

/**
 * Memory-grounded Q&A over the persistent world model. At demo scale the
 * whole session's memory fits in context, so full recall beats lossy
 * retrieval — the model answers ONLY from what Thread has stored.
 */
export async function askThread(db: Db, question: string): Promise<string> {
  if (!openRouterAvailable()) {
    throw new Error("Ask Thread needs OpenRouter configured (OPENROUTER_API_KEY).");
  }

  const [people, memories, loops, connections] = await Promise.all([
    db.collection<PersonDoc>(COLLECTIONS.people).find({ sessionId: SESSION_ID }).toArray(),
    db
      .collection<MemoryDoc>(COLLECTIONS.memories)
      .find({ sessionId: SESSION_ID })
      .sort({ createdAt: -1 })
      .limit(80)
      .toArray(),
    db
      .collection<OpenLoopDoc>(COLLECTIONS.openLoops)
      .find({ sessionId: SESSION_ID })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray(),
    db
      .collection<ConnectionDoc>(COLLECTIONS.connections)
      .find({ sessionId: SESSION_ID })
      .sort({ createdAt: -1 })
      .limit(15)
      .toArray(),
  ]);

  const nameOf = new Map(people.map((p) => [p._id!.toHexString(), p.name]));
  const n = (id: { toHexString(): string }) => nameOf.get(id.toHexString()) ?? "Someone";

  const context = [
    "PEOPLE:",
    ...people.map(
      (p) =>
        `- ${p.name}${p.shortDescription ? ` (${p.shortDescription})` : ""}${
          p.lastEncounterAt ? `, last spoke ${p.lastEncounterAt.toISOString()}` : ""
        }`
    ),
    "\nMEMORIES:",
    ...memories.map((m) => `- [${m.type}] ${n(m.personId)}: ${m.text}`),
    "\nPROMISES / OPEN LOOPS:",
    ...loops.map(
      (l) =>
        `- [${l.status}] ${l.owner === "user" ? `you → ${n(l.personId)}` : `${n(l.personId)} → you`}: ${l.description}`
    ),
    "\nCONNECTIONS DISCOVERED:",
    ...connections.map((c) => `- ${n(c.personAId)} ↔ ${n(c.personBId)}: ${c.reason}`),
  ].join("\n");

  const raw = await chatJSON({
    system: `You are Thread, an ambient memory layer for real-world relationships. Answer the user's question using ONLY the memory context provided — never invent people, facts, or promises. Be concise and conversational (1–3 sentences), refer to people by name, and include dates/times when stored. If the answer isn't in memory, say plainly that Thread hasn't stored that. Respond ONLY with JSON: {"answer": string}.`,
    user: `Memory context:\n"""\n${context}\n"""\n\nQuestion: ${question}`,
    maxTokens: 300,
  });

  return AnswerSchema.parse(raw).answer;
}
