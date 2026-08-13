import type { PersonLite, ProcessResult, ReturnBriefing } from "@/lib/types";

export interface AppStatus {
  mongo: boolean;
  elevenlabs: boolean;
  openrouter: boolean;
  embeddings: boolean;
  vectorIndex: "exists" | "created" | "unavailable";
  matchEngine: "vector" | "llm" | "keyword";
}

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  status: () => fetch("/api/status").then((r) => json<AppStatus>(r)),

  people: () =>
    fetch("/api/people")
      .then((r) => json<{ people: PersonLite[] }>(r))
      .then((d) => d.people),

  createPerson: (name: string) =>
    fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    })
      .then((r) => json<{ person: PersonLite }>(r))
      .then((d) => d.person),

  forgetPerson: (id: string) =>
    fetch(`/api/people/${id}`, { method: "DELETE" }).then((r) => json<{ forgotten: boolean }>(r)),

  transcribe: async (audio: Blob) => {
    const form = new FormData();
    form.append("audio", audio, "encounter.webm");
    const d = await json<{ text: string }>(
      await fetch("/api/transcribe", { method: "POST", body: form })
    );
    return d.text;
  },

  processEncounter: (personId: string, transcript: string, startedAt?: string) =>
    fetch("/api/encounters/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, transcript, startedAt }),
    })
      .then((r) => json<{ result: ProcessResult }>(r))
      .then((d) => d.result),

  briefing: (personId: string) =>
    fetch(`/api/people/${personId}/briefing`)
      .then((r) => json<{ briefing: ReturnBriefing }>(r))
      .then((d) => d.briefing),

  acknowledgeConnection: (id: string) =>
    fetch("/api/connections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then((r) => json<{ ok: boolean }>(r)),

  resetDemo: () =>
    fetch("/api/demo/reset", { method: "POST" }).then((r) => json<{ reset: boolean }>(r)),

  speak: async (text: string): Promise<Blob> => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || "TTS failed");
    }
    return res.blob();
  },
};
