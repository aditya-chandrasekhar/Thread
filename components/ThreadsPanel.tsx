"use client";

import { motion } from "framer-motion";

export interface ThreadsData {
  peopleCount: number;
  openLoops: { id: string; personName: string; description: string; owner: "user" | "person" }[];
  unmatched: { personName: string; type: "need" | "offer"; text: string }[];
  connections: { id: string; personAName: string; personBName: string; reason: string; engine: string }[];
}

/**
 * The global memory surface — every thread you're currently holding,
 * across all people: open promises, unmatched needs/offers, connections.
 */
export default function ThreadsPanel(props: {
  threads: ThreadsData;
  onCloseLoop: (id: string) => void;
  onClose: () => void;
}) {
  const { threads, onCloseLoop, onClose } = props;
  const userLoops = threads.openLoops.filter((l) => l.owner === "user");
  const theirLoops = threads.openLoops.filter((l) => l.owner === "person");
  const empty =
    threads.openLoops.length === 0 && threads.unmatched.length === 0 && threads.connections.length === 0;

  return (
    <motion.aside
      initial={{ x: -400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -400, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className="glass thin-scroll absolute left-5 top-20 bottom-24 z-30 w-[21rem] overflow-y-auto rounded-3xl p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Threads</h2>
          <p className="mt-0.5 text-xs text-white/45">
            what you&apos;re holding across {threads.peopleCount}{" "}
            {threads.peopleCount === 1 ? "person" : "people"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full border border-white/12 p-2 text-white/50 transition hover:border-white/30 hover:text-white/85"
          aria-label="Close threads"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {empty && (
        <p className="mt-8 text-center text-sm leading-relaxed text-white/35">
          Nothing yet. Meet someone —<br />
          Thread will hold what matters.
        </p>
      )}

      {(userLoops.length > 0 || theirLoops.length > 0) && (
        <section className="mt-6">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200/70">
            Don&apos;t forget
          </h3>
          <ul className="mt-2 space-y-2">
            {[...userLoops, ...theirLoops].map((l) => (
              <li key={l.id} className="group flex items-start gap-2.5">
                <button
                  onClick={() => onCloseLoop(l.id)}
                  title="Mark done"
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border transition ${
                    l.owner === "user"
                      ? "border-amber-300/50 hover:bg-amber-300/80"
                      : "border-white/25 hover:bg-white/40"
                  }`}
                />
                <div>
                  <p className="text-sm leading-snug text-white/85">{l.description}</p>
                  <p className="text-[11px] text-white/40">
                    {l.owner === "user" ? `you → ${l.personName}` : `${l.personName} → you`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {threads.connections.length > 0 && (
        <section className="mt-6">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-serendipity/80">
            Connections made
          </h3>
          <ul className="mt-2 space-y-2.5">
            {threads.connections.map((c) => (
              <li key={c.id} className="rounded-2xl border border-serendipity/20 bg-serendipity/[0.07] p-3">
                <p className="text-sm font-medium text-white/90">
                  {c.personAName} <span className="text-serendipity">↔</span> {c.personBName}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-white/60">{c.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {threads.unmatched.length > 0 && (
        <section className="mt-6">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/40">
            Waiting for a match
          </h3>
          <ul className="mt-2 space-y-1.5">
            {threads.unmatched.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm leading-snug text-white/70">
                <span
                  className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${
                    m.type === "need" ? "bg-serendipity/80" : "bg-thread/80"
                  }`}
                  title={m.type}
                />
                {m.text}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-snug text-white/30">
            Thread checks every new person against these automatically.
          </p>
        </section>
      )}
    </motion.aside>
  );
}
