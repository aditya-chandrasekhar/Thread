const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

export function elevenLabsAvailable(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/** Speech-to-text via ElevenLabs Scribe. */
export async function transcribeAudio(audio: Blob): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");

  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("file", audio, "encounter.webm");
  form.append("tag_audio_events", "false");

  const res = await fetch(`${ELEVEN_BASE}/speech-to-text`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs STT error ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { text?: string };
  if (!data.text) throw new Error("ElevenLabs returned an empty transcript");
  return data.text;
}

/** Text-to-speech for the whispered return briefing. Returns MP3 bytes. */
export async function speak(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb"; // George (premade, free-tier OK)

  const res = await fetch(`${ELEVEN_BASE}/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.45, similarity_boost: 0.7 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS error ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.arrayBuffer();
}
