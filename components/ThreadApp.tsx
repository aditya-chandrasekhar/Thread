"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { NewConnectionInfo, PersonLite, ProcessResult, ReturnBriefing } from "@/lib/types";
import { api, type AppStatus } from "./api";
import Webcam from "./Webcam";
import PersonPicker from "./PersonPicker";
import TranscriptSheet from "./TranscriptSheet";
import MemoryToast from "./MemoryToast";
import ConnectionReveal from "./ConnectionReveal";
import BriefingPanel from "./BriefingPanel";
import DemoPanel from "./DemoPanel";
import ThreadsPanel, { type ThreadsData } from "./ThreadsPanel";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

type Phase = "idle" | "recording" | "transcribing" | "processing";

interface SheetState {
  initialText: string;
  notice: string | null;
}

export default function ThreadApp() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [people, setPeople] = useState<PersonLite[]>([]);
  const [selected, setSelected] = useState<PersonLite | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [toast, setToast] = useState<ProcessResult | null>(null);
  const [reveal, setReveal] = useState<NewConnectionInfo | null>(null);
  const [briefing, setBriefing] = useState<ReturnBriefing | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadsData | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealQueueRef = useRef<NewConnectionInfo[]>([]);

  const refreshPeople = useCallback(async () => {
    try {
      const list = await api.people();
      setPeople(list);
      setSelected((prev) => (prev ? (list.find((p) => p.id === prev.id) ?? prev) : prev));
      return list;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach memory");
      return [];
    }
  }, []);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus(null));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state is set after awaits, not synchronously
    refreshPeople();
    api.threads().then(setThreads).catch(() => {});
  }, [refreshPeople]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ---------- encounter flow ----------

  const startEncounter = async () => {
    if (!selected) {
      setPickerOpen(true);
      return;
    }
    setError(null);
    setBriefing(null);
    startedAtRef.current = new Date().toISOString();
    setSeconds(0);
    setPhase("recording");
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch {
      recorderRef.current = null; // mic denied — manual transcript still works
    }
  };

  const endEncounter = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    recorderRef.current = null;

    let audio: Blob | null = null;
    if (recorder && recorder.state !== "inactive") {
      audio = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          recorder.stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        };
        recorder.stop();
      });
    }

    if (audio && audio.size > 2000 && status?.elevenlabs) {
      setPhase("transcribing");
      try {
        const text = await api.transcribe(audio);
        if (text.trim().length >= 10) {
          // Ambient by default: straight into memory, no confirmation step.
          await submitTranscript(text);
          return;
        }
        setSheet({
          initialText: text,
          notice: "The recording came back nearly empty — add or paste the conversation.",
        });
      } catch (err) {
        setSheet({
          initialText: "",
          notice: `Transcription failed (${
            err instanceof Error ? err.message : "unknown error"
          }). Paste the conversation manually.`,
        });
      }
    } else {
      setSheet({
        initialText: "",
        notice: audio
          ? "Voice transcription isn't configured — paste or type the conversation."
          : "No microphone audio captured — paste or type the conversation.",
      });
    }
    setPhase("idle");
  };

  const submitTranscript = async (transcript: string) => {
    if (!selected) return;
    setPhase("processing");
    setError(null);
    try {
      const result = await api.processEncounter(
        selected.id,
        transcript,
        startedAtRef.current ?? undefined
      );
      setSheet(null);
      setPhase("idle");
      showToast(result);
      refreshPeople();
      refreshThreads();
      if (result.newConnections.length > 0) {
        revealQueueRef.current = [...result.newConnections];
        setTimeout(() => popReveal(), 1600);
      }
    } catch (err) {
      setPhase("idle");
      // Never lose the words: surface the transcript for retry, even when
      // it skipped the review sheet on the way in.
      setSheet({
        initialText: transcript,
        notice: `Couldn't save memory: ${
          err instanceof Error ? err.message : "unknown error"
        }. Try again.`,
      });
    }
  };

  const refreshThreads = useCallback(async () => {
    try {
      setThreads(await api.threads());
    } catch {
      /* panel simply stays stale */
    }
  }, []);

  const toggleThreads = async () => {
    if (!threadsOpen) {
      setDemoOpen(false); // shares the left edge with the demo panel
      await refreshThreads();
    }
    setThreadsOpen((v) => !v);
  };

  const closeLoop = async (id: string) => {
    await api.closeLoop(id).catch(() => {});
    refreshThreads();
    if (briefing) selectPersonBriefing(briefing.person.id);
  };

  const selectPersonBriefing = async (personId: string) => {
    try {
      setBriefing(await api.briefing(personId));
    } catch {
      /* keep old briefing */
    }
  };

  const showToast = (result: ProcessResult) => {
    setToast(result);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 7000);
  };

  const popReveal = () => {
    const next = revealQueueRef.current.shift() ?? null;
    setReveal(next);
  };

  const rememberConnection = async () => {
    if (reveal) api.acknowledgeConnection(reveal.id).catch(() => {});
    popReveal();
  };

  // ---------- identity ----------

  const selectPerson = async (p: PersonLite) => {
    setSelected(p);
    setPickerOpen(false);
    setBriefing(null);
    if (p.lastEncounterAt) {
      try {
        setBriefing(await api.briefing(p.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load briefing");
      }
    }
  };

  const createPerson = async (name: string) => {
    const person = await api.createPerson(name);
    await refreshPeople();
    setSelected(person);
    setPickerOpen(false);
    setBriefing(null);
  };

  const forgetPerson = async (p: PersonLite) => {
    await api.forgetPerson(p.id).catch(() => {});
    if (selected?.id === p.id) {
      setSelected(null);
      setBriefing(null);
    }
    refreshPeople();
  };

  // ---------- demo scenes ----------

  const loadScene = async (who: "maya" | "daniel") => {
    setDemoOpen(false);
    setBriefing(null);
    const wantedName = who === "maya" ? "Maya" : "Daniel";
    const list = await refreshPeople();
    let person = list.find((p) => p.name.toLowerCase() === who) ?? null;
    if (!person) {
      person = await api.createPerson(wantedName);
      await refreshPeople();
    }
    setSelected(person);
    startedAtRef.current = new Date().toISOString();
    setSheet({ initialText: "", notice: null });
  };

  const returnScene = async (name: string) => {
    setDemoOpen(false);
    const list = await refreshPeople();
    const person = list.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!person) {
      setError(`${name} hasn't been met yet — run scene 1 first.`);
      return;
    }
    await selectPerson(person);
  };

  const resetDemo = async () => {
    setDemoOpen(false);
    setSelected(null);
    setBriefing(null);
    setToast(null);
    setReveal(null);
    setSheet(null);
    setThreads(null);
    setThreadsOpen(false);
    revealQueueRef.current = [];
    try {
      await api.resetDemo();
      await refreshPeople();
      api.status().then(setStatus).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    }
  };

  const busy = phase === "processing" || phase === "transcribing";
  const mongoOnline = status?.mongo ?? null;

  return (
    <main className="ambient-backdrop relative h-dvh w-full overflow-hidden">
      <Webcam />

      {/* top bar */}
      <header className="absolute inset-x-0 top-0 z-30 flex items-start justify-between p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <ThreadMark />
            <h1 className="text-lg font-semibold tracking-tight">Thread</h1>
          </div>
          <p className="mt-0.5 pl-[30px] text-xs text-white/45">Never lose the thread.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleThreads}
            className={`glass-subtle flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition ${
              threadsOpen ? "text-white" : "text-white/55 hover:text-white/85"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M3 14c3.5 1 6-1.5 7-4s3.5-5 7-4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            Threads
            {threads && threads.openLoops.length > 0 && !threadsOpen && (
              <span className="ml-0.5 rounded-full bg-amber-300/90 px-1.5 text-[10px] font-semibold text-black">
                {threads.openLoops.length}
              </span>
            )}
          </button>
          {DEMO_MODE && (
            <button
              onClick={() => {
                setThreadsOpen(false);
                setDemoOpen((v) => !v);
              }}
              className={`glass-subtle rounded-full px-3.5 py-1.5 text-xs transition ${
                demoOpen ? "text-white" : "text-white/55 hover:text-white/85"
              }`}
            >
              Demo
            </button>
          )}
          <div className="glass-subtle flex items-center gap-2 rounded-full px-3.5 py-1.5">
            <span
              className={`pulse-dot h-1.5 w-1.5 rounded-full ${
                mongoOnline === null ? "bg-white/40" : mongoOnline ? "bg-thread" : "bg-red-400"
              }`}
            />
            <span className="text-xs text-white/70">
              {mongoOnline === null ? "Connecting…" : mongoOnline ? "Memory online" : "Memory offline"}
            </span>
          </div>
        </div>
      </header>

      {/* error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute left-1/2 top-20 z-40 -translate-x-1/2"
          >
            <button
              onClick={() => setError(null)}
              className="glass rounded-full border-red-300/25 px-4 py-2 text-xs text-red-200/90"
            >
              {error} · dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* processing veil */}
      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[45] flex items-center justify-center bg-black/40"
          >
            <div className="flex flex-col items-center gap-4">
              <SpinningThread />
              <p className="thread-shimmer text-sm font-medium">
                {phase === "transcribing"
                  ? "Listening back to the conversation…"
                  : "Turning conversation into memory…"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* toast (memory saved) */}
      <div className="pointer-events-none absolute right-5 top-20 z-30">
        <AnimatePresence>
          {toast && <MemoryToast result={toast} onDone={() => setToast(null)} />}
        </AnimatePresence>
      </div>

      {/* overlays */}
      <AnimatePresence>
        {reveal && (
          <ConnectionReveal key={reveal.id} connection={reveal} onRemember={rememberConnection} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheet && selected && (
          <TranscriptSheet
            personName={selected.name}
            initialText={sheet.initialText}
            notice={sheet.notice}
            demoMode={DEMO_MODE}
            busy={busy}
            onCancel={() => setSheet(null)}
            onSubmit={submitTranscript}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {briefing && !sheet && !reveal && phase === "idle" && (
          <BriefingPanel
            briefing={briefing}
            ttsAvailable={status?.elevenlabs ?? false}
            onClose={() => setBriefing(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pickerOpen && (
          <PersonPicker
            people={people}
            selectedId={selected?.id ?? null}
            onSelect={selectPerson}
            onCreate={createPerson}
            onForget={forgetPerson}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {threadsOpen && threads && (
          <ThreadsPanel
            threads={threads}
            askAvailable={status?.openrouter ?? false}
            ttsAvailable={status?.elevenlabs ?? false}
            onCloseLoop={closeLoop}
            onClose={() => setThreadsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {DEMO_MODE && demoOpen && (
          <DemoPanel
            status={status}
            busy={busy}
            onReset={resetDemo}
            onLoadScene={loadScene}
            onReturnScene={returnScene}
            onClose={() => setDemoOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* bottom dock */}
      <div className="absolute inset-x-0 bottom-6 z-30 flex justify-center">
        <div className="glass flex items-center gap-3 rounded-full py-2 pl-2 pr-2">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            disabled={phase === "recording"}
            className="flex items-center gap-2.5 rounded-full px-3 py-1.5 transition hover:bg-white/8 disabled:opacity-60"
          >
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                selected ? "bg-thread/20 text-thread" : "bg-white/10 text-white/50"
              }`}
            >
              {selected ? selected.name[0]?.toUpperCase() : "?"}
            </span>
            <span className="text-left">
              <span className="block text-[9px] uppercase tracking-[0.16em] text-white/35">
                Prototype identity
              </span>
              <span className="block text-sm font-medium text-white/90">
                {selected ? selected.name : "Choose person"}
              </span>
            </span>
          </button>

          <div className="h-7 w-px bg-white/10" />

          {phase === "recording" ? (
            <div className="flex items-center gap-3 pr-1">
              <span className="flex items-center gap-2 text-xs text-white/60">
                <span className="rec-pulse h-2 w-2 rounded-full bg-red-400" />
                {formatTime(seconds)}
              </span>
              <button
                onClick={endEncounter}
                className="rounded-full bg-red-400/90 px-5 py-2.5 text-sm font-medium text-black transition hover:bg-red-400"
              >
                End encounter
              </button>
            </div>
          ) : (
            <button
              onClick={startEncounter}
              disabled={busy}
              className="rounded-full bg-thread/90 px-5 py-2.5 text-sm font-medium text-black transition hover:bg-thread disabled:opacity-40"
            >
              Start encounter
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

function formatTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function ThreadMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M3 14c3.5 1 6-1.5 7-4s3.5-5 7-4"
        stroke="var(--thread-green)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="3.2" cy="14.2" r="1.7" fill="var(--thread-green)" />
      <circle cx="16.8" cy="5.8" r="1.7" fill="var(--thread-violet)" />
    </svg>
  );
}

function SpinningThread() {
  return (
    <motion.svg
      width="34"
      height="34"
      viewBox="0 0 34 34"
      fill="none"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
    >
      <circle cx="17" cy="17" r="14" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
      <path
        d="M17 3a14 14 0 0 1 12.1 7"
        stroke="var(--thread-green)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </motion.svg>
  );
}
