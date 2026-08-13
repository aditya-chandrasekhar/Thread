"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import type { ReturnBriefing } from "@/lib/types";
import { api } from "./api";

const sectionAnim = (i: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.15 + i * 0.12 },
});

/** The return briefing — proof that memory changes what happens next. */
export default function BriefingPanel(props: {
  briefing: ReturnBriefing;
  ttsAvailable: boolean;
  onClose: () => void;
}) {
  const { briefing, ttsAvailable, onClose } = props;
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const whisper = async () => {
    if (speaking) {
      audioRef.current?.pause();
      setSpeaking(false);
      return;
    }
    try {
      setSpeaking(true);
      const blob = await api.speak(briefing.spokenBriefing);
      const audio = new Audio(URL.createObjectURL(blob));
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch {
      setSpeaking(false);
    }
  };

  const userLoops = briefing.openLoops.filter((l) => l.owner === "user");
  const theirLoops = briefing.openLoops.filter((l) => l.owner === "person");

  return (
    <motion.aside
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className="glass thin-scroll absolute right-5 top-20 bottom-24 z-30 w-[22.5rem] overflow-y-auto rounded-3xl p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
            returning
          </p>
          <h2 className="mt-1 text-2xl font-semibold uppercase tracking-wide text-white">
            {briefing.person.name}
          </h2>
          {briefing.person.shortDescription && (
            <p className="mt-0.5 text-sm text-white/55">{briefing.person.shortDescription}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {ttsAvailable && (
            <button
              onClick={whisper}
              title="Whisper briefing"
              className={`rounded-full border p-2 transition ${
                speaking
                  ? "border-thread/60 text-thread"
                  : "border-white/12 text-white/50 hover:border-white/30 hover:text-white/85"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 1.5a2.5 2.5 0 0 0-2.5 2.5v4a2.5 2.5 0 0 0 5 0V4A2.5 2.5 0 0 0 8 1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M3.5 7.5V8a4.5 4.5 0 0 0 9 0v-.5M8 12.5v2"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full border border-white/12 p-2 text-white/50 transition hover:border-white/30 hover:text-white/85"
            aria-label="Close briefing"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <motion.section {...sectionAnim(0)} className="mt-6">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
          Last time
        </h3>
        <ul className="mt-2 space-y-1.5">
          {briefing.lastTime.length === 0 && (
            <li className="text-sm text-white/40">Nothing memorable yet.</li>
          )}
          {briefing.lastTime.map((t, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-snug text-white/80">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/30" />
              {t}
            </li>
          ))}
        </ul>
      </motion.section>

      {(userLoops.length > 0 || theirLoops.length > 0) && (
        <motion.section {...sectionAnim(1)} className="mt-5">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200/70">
            Don&apos;t forget
          </h3>
          <ul className="mt-2 space-y-1.5">
            {userLoops.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-snug text-amber-100/90">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-amber-300" />
                {l.description}
              </li>
            ))}
            {theirLoops.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-snug text-white/70">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/30" />
                They owe you: {l.description}
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {briefing.newSinceLastSpoke.length > 0 && (
        <motion.section {...sectionAnim(2)} className="mt-5">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-serendipity/80">
            New since you last spoke
          </h3>
          <ul className="mt-2 space-y-2.5">
            {briefing.newSinceLastSpoke.map((c, i) => (
              <li key={i} className="rounded-2xl border border-serendipity/20 bg-serendipity/[0.07] p-3">
                <p className="text-sm font-medium text-white/90">You met {c.withPersonName}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-white/65">{c.reason}</p>
              </li>
            ))}
          </ul>
        </motion.section>
      )}

      {briefing.suggestedAction && (
        <motion.section {...sectionAnim(3)} className="mt-5">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-thread/80">
            Best next move
          </h3>
          <p className="mt-2 text-sm font-medium text-white/90">{briefing.suggestedAction}</p>
          {briefing.suggestedOpener && (
            <p className="mt-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-[13px] italic leading-snug text-white/60">
              &ldquo;{briefing.suggestedOpener}&rdquo;
            </p>
          )}
        </motion.section>
      )}
    </motion.aside>
  );
}
