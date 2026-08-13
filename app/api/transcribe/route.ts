import { elevenLabsAvailable, transcribeAudio } from "@/lib/elevenlabs";

export async function POST(request: Request) {
  try {
    if (!elevenLabsAvailable()) {
      return Response.json(
        { error: "ElevenLabs is not configured — paste the transcript manually instead." },
        { status: 503 }
      );
    }
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob) || file.size === 0) {
      return Response.json({ error: "No audio received" }, { status: 400 });
    }
    const text = await transcribeAudio(file);
    return Response.json({ text });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
