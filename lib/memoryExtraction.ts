import { z } from "zod";
import { chatJSON, openRouterAvailable } from "./openrouter";
import { MEMORY_TYPES, type ExtractionResult, type ExtractedMemory } from "./types";

const ExtractionSchema = z.object({
  summary: z.string().min(1),
  shortDescription: z.string().optional(),
  memories: z
    .array(
      z.object({
        type: z.enum(MEMORY_TYPES),
        text: z.string().min(1),
        sourceText: z.string().default(""),
        importance: z.coerce.number().min(1).max(5).default(3),
      })
    )
    .max(12),
});

const SYSTEM_PROMPT = `You are the memory-extraction agent for Thread, an ambient memory layer for real-world relationships. You receive a transcript of a short in-person conversation between the user and one other person. Extract ONLY durable, useful memories about that person.

KEEP (only if actually present):
- what they work on / build (type "fact")
- meaningful interests (type "interest")
- things they need or are looking for — help, expertise, intros ("need")
- expertise, skills, tools, or resources they could help OTHERS with ("offer") — professional expertise is ALWAYS an offer, not a fact. Example: "I work a lot with MongoDB Atlas Vector Search" → type "offer": "Daniel has deep expertise with MongoDB Atlas Vector Search."
- promises the USER made to them ("commitment_user_to_person")
- promises THEY made to the user ("commitment_person_to_user")

Type choice matters: "need" and "offer" memories are matched against other people's memories to surface introductions. When someone states a skill or domain they work in, classify it as "offer" even if it also sounds like a fact.

IGNORE: greetings, filler, small talk, duplicates, and sensitive personal details. Memory should feel selective, not like surveillance. Typically 2–6 memories per conversation.

Each memory: "text" is a crisp standalone sentence about the person (use their name or "they"), "sourceText" is the short transcript quote it came from, "importance" is 1–5.

Also produce:
- "summary": one or two sentences summarizing the encounter.
- "shortDescription": 2–5 word descriptor of the person (e.g. "Robotics founder").

Respond with ONLY a JSON object: {"summary": string, "shortDescription": string, "memories": [{"type": string, "text": string, "sourceText": string, "importance": number}]}`;

export async function extractMemories(opts: {
  transcript: string;
  personName: string;
  existingContext?: string;
}): Promise<{ result: ExtractionResult; engine: "llm" | "fallback" }> {
  const { transcript, personName, existingContext } = opts;

  if (openRouterAvailable()) {
    const userMsg = `Person's name: ${personName}
${existingContext ? `Already known about them (do NOT duplicate): ${existingContext}\n` : ""}
Transcript:
"""
${transcript}
"""`;
    // one attempt + one repair retry
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await chatJSON({
          system:
            attempt === 0
              ? SYSTEM_PROMPT
              : SYSTEM_PROMPT +
                "\n\nIMPORTANT: Your previous output failed schema validation. Output STRICTLY valid JSON matching the schema, nothing else.",
          user: userMsg,
        });
        const parsed = ExtractionSchema.parse(raw);
        return {
          result: {
            summary: parsed.summary,
            shortDescription: parsed.shortDescription,
            memories: (parsed.memories as ExtractedMemory[]).map(normalizeMemoryType),
          },
          engine: "llm",
        };
      } catch (err) {
        if (attempt === 1) {
          console.error("LLM extraction failed twice, using fallback parser:", err);
        }
      }
    }
  }

  return { result: fallbackExtract(transcript, personName), engine: "fallback" };
}

/**
 * Safety net for model misclassification: an explicit statement of expertise
 * filed as "fact" is really an "offer" — the type the connection matcher
 * searches on. Generic phrasing check, no names or domains hardcoded.
 */
export function normalizeMemoryType(m: ExtractedMemory): ExtractedMemory {
  if (
    m.type === "fact" &&
    /\b(expertise|expert in|specializ|works? (a lot |extensively |heavily )?with|deep experience|knows? \S+ (very )?well)\b/i.test(
      `${m.text} ${m.sourceText}`
    )
  ) {
    return { ...m, type: "offer" };
  }
  return m;
}

/**
 * Deterministic fallback parser — used only when the LLM is unavailable or
 * fails validation twice. Keyword heuristics good enough for demo transcripts.
 */
export function fallbackExtract(transcript: string, personName: string): ExtractionResult {
  const memories: ExtractedMemory[] = [];
  const sentences = transcript
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  const seen = new Set<string>();
  const push = (m: ExtractedMemory) => {
    const key = m.type + m.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      memories.push(m);
    }
  };

  let shortDescription: string | undefined;

  for (const s of sentences) {
    const lower = s.toLowerCase();
    // Skip likely user lines that aren't commitments
    const isCommitmentByUser = /\bi(?:'|’)?ll (send|share|intro|introduce|connect|email|text)\b/.test(lower);
    if (isCommitmentByUser) {
      const promised = (lower.match(/i(?:'|’)?ll (.*)/)?.[1] ?? `follow up with ${personName}`)
        .replace(/[.!?]$/, "")
        .replace(/\byou\b/g, personName);
      push({
        type: "commitment_user_to_person",
        text: `You promised to ${promised}.`,
        sourceText: s,
        importance: 5,
      });
      continue;
    }
    const isInterestSentence = /\b(love to meet|interested in|excited about|passionate about|i'?d love to)\b/.test(lower);
    if (!isInterestSentence && /\b(building|founder|working on|startup|i work at|i'm at)\b/.test(lower)) {
      push({
        type: "fact",
        text: `${personName}: ${s.replace(/^(hey|hi|hello)[,!.\s]*/i, "").replace(/^i'?m [a-z]+[,.]?\s*/i, "")}`.replace(/[.!?]$/, "."),
        sourceText: s,
        importance: 4,
      });
      if (/robotics/.test(lower)) shortDescription = "Robotics founder";
      else if (/startup/.test(lower)) shortDescription = "Startup founder";
    }
    if (/\b(trouble with|struggling with|need help|looking for|need someone|like to meet (somebody|someone)|meet someone who)\b/.test(lower)) {
      const topic = /vector search|mongodb/.test(lower)
        ? "vector search / MongoDB expertise"
        : s.replace(/[.!?]$/, "");
      push({
        type: "need",
        text: `${personName} needs ${topic}.`,
        sourceText: s,
        importance: 5,
      });
    }
    if (/\b(i work (a lot )?with|i specialize|my expertise|i know .* well|i do a lot of)\b/.test(lower)) {
      const topic = /mongodb atlas vector search|atlas vector search/.test(lower)
        ? "MongoDB Atlas Vector Search"
        : /mongodb/.test(lower)
          ? "MongoDB"
          : s.replace(/[.!?]$/, "");
      push({
        type: "offer",
        text: `${personName} has expertise with ${topic}.`,
        sourceText: s,
        importance: 5,
      });
      if (/mongodb/.test(lower)) shortDescription = shortDescription ?? "MongoDB expert";
    }
    if (isInterestSentence) {
      push({
        type: "interest",
        text: `${personName} is interested in ${
          /robotics/.test(lower) ? "meeting people building robotics products" : s.replace(/[.!?]$/, "")
        }.`,
        sourceText: s,
        importance: 3,
      });
    }
  }

  return {
    summary: `Met ${personName}. ${memories
      .slice(0, 2)
      .map((m) => m.text)
      .join(" ")}`.trim(),
    shortDescription,
    memories: memories.slice(0, 8),
  };
}
