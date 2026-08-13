"use client";

import { motion } from "framer-motion";
import type { NewConnectionInfo } from "@/lib/types";

/**
 * The serendipity moment — two people drawn together by memories from
 * separate conversations.
 */
export default function ConnectionReveal(props: {
  connection: NewConnectionInfo;
  onRemember: () => void;
}) {
  const { connection, onRemember } = props;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 p-6"
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 18 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.97, opacity: 0, y: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="glass relative w-full max-w-md overflow-hidden rounded-3xl p-8 text-center"
      >
        {/* violet aura */}
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(167,139,250,0.16), transparent 70%)",
          }}
        />

        <p className="relative text-[11px] font-medium uppercase tracking-[0.18em] text-serendipity">
          New connection
        </p>
        <h2 className="relative mt-2 text-xl font-medium tracking-tight text-white">
          A connection you would&apos;ve missed
        </h2>

        <div className="relative mt-7 flex items-center justify-center gap-0">
          <motion.div
            initial={{ x: -46, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 220, damping: 20 }}
            className="glass-subtle z-10 rounded-2xl px-5 py-3"
          >
            <p className="text-sm font-medium">{connection.personAName}</p>
            <p className="text-[10px] uppercase tracking-wider text-serendipity/80">needs</p>
          </motion.div>

          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.45, ease: "easeOut" }}
            className="h-px w-12 origin-center bg-gradient-to-r from-serendipity/70 to-thread/70"
          />

          <motion.div
            initial={{ x: 46, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.25, type: "spring", stiffness: 220, damping: 20 }}
            className="glass-subtle z-10 rounded-2xl px-5 py-3"
          >
            <p className="text-sm font-medium">{connection.personBName}</p>
            <p className="text-[10px] uppercase tracking-wider text-thread/80">offers</p>
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="relative mx-auto mt-6 max-w-sm text-sm leading-relaxed text-white/70"
        >
          {connection.reason}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="relative mt-7"
        >
          <button
            onClick={onRemember}
            className="rounded-full bg-serendipity/90 px-6 py-2.5 text-sm font-medium text-black transition hover:bg-serendipity"
          >
            Remember for next time
          </button>
          <p className="mt-3 text-[10px] uppercase tracking-wide text-white/25">
            matched via {connection.engine === "vector" ? "Atlas Vector Search" : `${connection.engine} engine`}
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
