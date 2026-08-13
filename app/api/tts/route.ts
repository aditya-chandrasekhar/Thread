import { elevenLabsAvailable, speak } from "@/lib/elevenlabs";

export async function POST(request: Request) {
  try {
    if (!elevenLabsAvailable()) {
      return Response.json({ error: "ElevenLabs is not configured" }, { status: 503 });
    }
    const { text } = (await request.json()) as { text?: string };
    if (!text?.trim()) return Response.json({ error: "text is required" }, { status: 400 });
    const audio = await speak(text.slice(0, 900));
    return new Response(audio, { headers: { "Content-Type": "audio/mpeg" } });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "TTS failed" },
      { status: 500 }
    );
  }
}
