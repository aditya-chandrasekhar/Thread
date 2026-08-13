"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { DEMO_TRANSCRIPTS } from "@/lib/demoScript";

/**
 * Review/edit the transcript before it becomes memory. Doubles as the manual
 * fallback when transcription is unavailable or noisy at the venue.
 */
export default function TranscriptSheet(props: {
  personName: string;
  initialText: string;
  notice: string | null;
  demoMode: boolean;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (transcript: string) => void;
}) {
  const { personName, initialText, notice, demoMode, busy, onCancel, onSubmit } = props;
  // The sheet remounts per encounter, so local state seeded once is enough.
  const [text, setText] = useState(initialText);

  const demoKey = personName.trim().toLowerCase();
  const demo = DEMO_TRANSCRIPTS[demoKey];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-6"
    >
      <motion.div
        initial={{ y: 26, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="glass w-full max-w-xl rounded-3xl p-6"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-medium tracking-tight">
            Conversation with <span className="text-thread">{personName}</span>
          </h2>
          <span className="text-xs text-white/40">review before it becomes memory</span>
        </div>

        {notice && (
          <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200/90">
            {notice}
          </p>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste or edit the conversation here…`}
          spellCheck={false}
          className="thin-scroll mt-4 h-52 w-full resize-none rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/85 outline-none placeholder:text-white/25 focus:border-white/25"
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {demoMode && demo && (
              <button
                onClick={() => setText(demo.transcript)}
                className="rounded-full border border-white/12 px-3.5 py-1.5 text-xs text-white/60 transition hover:border-white/25 hover:text-white/85"
              >
                Load demo conversation
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              disabled={busy}
              className="rounded-full px-4 py-2 text-sm text-white/50 transition hover:text-white/80 disabled:opacity-40"
            >
              Discard
            </button>
            <button
              onClick={() => onSubmit(text)}
              disabled={busy || text.trim().length < 10}
              className="rounded-full bg-thread/90 px-5 py-2 text-sm font-medium text-black transition hover:bg-thread disabled:cursor-not-allowed disabled:opacity-30"
            >
              Turn into memory
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
