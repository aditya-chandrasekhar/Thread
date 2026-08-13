"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { PersonLite } from "@/lib/types";

/**
 * Explicit prototype identity selection — the stand-in for ambient hardware.
 * Pick a returning person, or "Meet someone" new.
 */
export default function PersonPicker(props: {
  people: PersonLite[];
  selectedId: string | null;
  onSelect: (person: PersonLite) => void;
  onCreate: (name: string) => Promise<void>;
  onForget: (person: PersonLite) => void;
  onClose: () => void;
}) {
  const { people, selectedId, onSelect, onCreate, onForget, onClose } = props;
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await onCreate(name.trim());
      setName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="glass absolute bottom-24 left-1/2 z-40 w-[21rem] -translate-x-1/2 rounded-3xl p-4"
    >
      <div className="flex items-center justify-between px-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
          Prototype identity
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

      <div className="thin-scroll mt-3 max-h-56 space-y-1 overflow-y-auto">
        {people.length === 0 && (
          <p className="px-2 py-3 text-center text-sm text-white/35">
            No one remembered yet. Meet someone below.
          </p>
        )}
        {people.map((p) => (
          <div
            key={p.id}
            className={`group flex w-full items-center justify-between rounded-2xl px-3 py-2.5 transition ${
              p.id === selectedId ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <button onClick={() => onSelect(p)} className="flex-1 text-left">
              <p className="text-sm font-medium text-white/90">{p.name}</p>
              <p className="text-xs text-white/45">
                {p.shortDescription ||
                  (p.lastEncounterAt ? "remembered" : "just met — no memories yet")}
              </p>
            </button>
            <div className="flex items-center gap-2">
              {p.lastEncounterAt && (
                <span className="h-1.5 w-1.5 rounded-full bg-thread/80" title="Has memories" />
              )}
              <button
                onClick={() => onForget(p)}
                title={`Forget ${p.name}`}
                className="rounded-full p-1 text-white/0 transition group-hover:text-white/30 hover:!text-red-300"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 4.5h10M6.5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M5 4.5l.5 8a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1l.5-8"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder="Meet someone — their name"
          className="flex-1 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm text-white/85 outline-none placeholder:text-white/30 focus:border-white/25"
        />
        <button
          onClick={create}
          disabled={!name.trim() || creating}
          className="rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white/90 transition hover:bg-white/20 disabled:opacity-30"
        >
          Meet
        </button>
      </div>
    </motion.div>
  );
}
