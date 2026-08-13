"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { AppStatus } from "./api";

/**
 * Discreet demo controls + prototype principles. Only rendered when
 * NEXT_PUBLIC_DEMO_MODE=true.
 */
export default function DemoPanel(props: {
  status: AppStatus | null;
  busy: boolean;
  onReset: () => Promise<void>;
  onLoadScene: (who: "maya" | "daniel") => Promise<void>;
  onReturnScene: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const { status, busy, onReset, onLoadScene, onReturnScene, onClose } = props;
  const [confirmReset, setConfirmReset] = useState(false);

  const btn =
    "w-full rounded-2xl border border-white/10 px-4 py-2.5 text-left text-sm text-white/75 transition hover:border-white/25 hover:text-white disabled:opacity-35 disabled:cursor-not-allowed";

  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -14 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="glass absolute left-5 top-20 z-40 w-72 rounded-3xl p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
          Demo controls
        </p>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-white/35 transition hover:text-white/70"
          aria-label="Close"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <button disabled={busy} className={btn} onClick={() => onLoadScene("maya")}>
          <span className="mr-2 text-white/35">1</span> Meet Maya
          <span className="block pl-5 text-xs text-white/40">robotics founder, needs vector search</span>
        </button>
        <button disabled={busy} className={btn} onClick={() => onLoadScene("daniel")}>
          <span className="mr-2 text-white/35">2</span> Meet Daniel
          <span className="block pl-5 text-xs text-white/40">Atlas Vector Search expert</span>
        </button>
        <button disabled={busy} className={btn} onClick={() => onReturnScene("Maya")}>
          <span className="mr-2 text-white/35">3</span> Maya returns
          <span className="block pl-5 text-xs text-white/40">show the return briefing</span>
        </button>

        {confirmReset ? (
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="flex-1 rounded-2xl bg-red-400/85 px-4 py-2.5 text-sm font-medium text-black transition hover:bg-red-400"
              onClick={async () => {
                await onReset();
                setConfirmReset(false);
              }}
            >
              Wipe demo data
            </button>
            <button
              className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-white/60"
              onClick={() => setConfirmReset(false)}
            >
              Keep
            </button>
          </div>
        ) : (
          <button disabled={busy} className={btn} onClick={() => setConfirmReset(true)}>
            Reset demo
            <span className="block text-xs text-white/40">clear this session&apos;s records</span>
          </button>
        )}
      </div>

      {status && (
        <div className="mt-4 space-y-1 border-t border-white/8 pt-3 text-[11px] text-white/45">
          <StatusRow ok={status.mongo} label="MongoDB Atlas" />
          <StatusRow ok={status.openrouter} label="OpenRouter extraction" />
          <StatusRow ok={status.elevenlabs} label="ElevenLabs voice" />
          <StatusRow
            ok={status.matchEngine === "vector"}
            warn={status.matchEngine !== "vector"}
            label={`Matching: ${
              status.matchEngine === "vector"
                ? "Atlas Vector Search"
                : `${status.matchEngine} fallback`
            }`}
          />
        </div>
      )}

      <p className="mt-4 border-t border-white/8 pt-3 text-[11px] leading-relaxed text-white/35">
        Thread remembers useful context, not raw life. Memories are structured and selective, keep
        their source quotes, and any person can be forgotten with one tap.
      </p>
    </motion.div>
  );
}

function StatusRow({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  return (
    <p className="flex items-center gap-2">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          ok ? "bg-thread" : warn ? "bg-amber-300" : "bg-red-400/80"
        }`}
      />
      {label}
    </p>
  );
}
