import { z } from "zod";
import { chatJSON, openRouterAvailable } from "./openrouter";

const IdentifySchema = z.object({ name: z.string().nullable() });

/**
 * Work out who the OTHER person in the conversation is, from the transcript
 * alone — the ambient alternative to typing a name. LLM first, then a
 * deterministic "self-introduction" fallback.
 *
 * USER_NAME (env) tells Thread which name belongs to the wearer, so the
 * user introducing themselves is never mistaken for the person they met.
 */
export async function identifyPersonName(transcript: string): Promise<string | null> {
  const userName = process.env.USER_NAME?.trim();

  if (openRouterAvailable()) {
    try {
      const raw = await chatJSON({
        system: `You read a transcript of a short in-person conversation between the user (who wears the recording device) and ONE other person they just met. Identify the OTHER person's first name — never the user's. ${
          userName ? `The user's name is ${userName}. ` : ""
        }Clues: the other person usually introduces themselves ("I'm …", "my name is …") or is addressed by name. Respond ONLY with JSON: {"name": string} or {"name": null} if the other person's name never appears.`,
        user: transcript.slice(0, 4000),
        maxTokens: 60,
      });
      const parsed = IdentifySchema.parse(raw);
      const name = parsed.name?.trim();
      if (name && (!userName || name.toLowerCase() !== userName.toLowerCase())) {
        return capitalize(name);
      }
    } catch {
      /* fall through to heuristic */
    }
  }

  // Fallback: self-introductions in order; the user (if known) is excluded,
  // and the LAST introduction wins — the user typically introduces first.
  // Only capitalized words qualify, so "I'm building…" / "I'm here…" don't.
  const NOT_NAMES = new Set([
    "building", "here", "working", "looking", "trying", "going", "excited", "glad",
    "happy", "sure", "sorry", "good", "great", "really", "just", "not", "so", "very",
    "the", "a", "an", "also", "actually", "currently", "still",
  ]);
  const intros = [...transcript.matchAll(/\b(?:i'?m|i am|my name'?s|my name is|this is)\s+([A-Za-z]+)\b/gi)]
    .map((m) => m[1])
    .filter((n) => /^[A-Z]/.test(n) && !NOT_NAMES.has(n.toLowerCase()));
  const candidates = intros.filter((n) => !userName || n.toLowerCase() !== userName.toLowerCase());
  return candidates.length > 0 ? capitalize(candidates[candidates.length - 1]) : null;
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}
