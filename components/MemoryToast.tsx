"use client";

import { motion } from "framer-motion";
import type { ProcessResult } from "@/lib/types";

/** Subtle confirmation after an encounter is distilled into memory. */
export default function MemoryToast(props: { result: ProcessResult; onDone: () => void }) {
  const { result, onDone } = props;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="glass pointer-events-auto w-80 rounded-2xl p-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium tracking-tight">
            <span className="text-thread text-glow-green">{result.personName}</span> remembered
          </p>
          <p className="mt-0.5 text-xs text-white/55">
            {result.memoriesSaved} useful {result.memoriesSaved === 1 ? "memory" : "memories"}
            {result.openLoopsCreated > 0 &&
              ` · ${result.openLoopsCreated} open ${result.openLoopsCreated === 1 ? "loop" : "loops"}`}
          </p>
        </div>
        <button
          onClick={onDone}
          className="-mr-1 -mt-1 rounded-full p-1 text-white/35 transition hover:text-white/70"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {result.memories.slice(0, 4).map((m, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.09 }}
            className="flex items-start gap-2 text-xs text-white/70"
          >
            <span
              className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                m.type === "need"
                  ? "bg-serendipity"
                  : m.type === "offer"
                    ? "bg-thread"
                    : m.type.startsWith("commitment")
                      ? "bg-amber-300"
                      : "bg-white/30"
              }`}
            />
            <span className="leading-snug">{m.text}</span>
          </motion.li>
        ))}
      </ul>
      {result.extractionEngine === "fallback" && (
        <p className="mt-2 text-[10px] uppercase tracking-wide text-white/30">
          offline parser (LLM unavailable)
        </p>
      )}
    </motion.div>
  );
}
