const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export function openRouterAvailable(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Minimal OpenRouter chat call that expects a JSON object back.
 * Model is configurable via OPENROUTER_MODEL.
 */
export async function chatJSON(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const model = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.5";

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://thread.local",
      "X-Title": "Thread",
    },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 1600,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");
  return extractJSON(content);
}

/** Tolerant JSON extraction — models sometimes wrap JSON in fences/prose. */
export function extractJSON(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // try fenced block
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        /* fall through */
      }
    }
    // try first {...} span
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Could not parse JSON from model output");
  }
}
