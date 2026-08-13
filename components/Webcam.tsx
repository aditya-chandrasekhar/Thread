"use client";

import { useEffect, useRef, useState } from "react";

/** Full-bleed webcam feed with a graceful fallback when the camera is off. */
export default function Webcam() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"pending" | "live" | "denied">("pending");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
        setState("live");
      })
      .catch(() => setState("denied"));

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`h-full w-full scale-x-[-1] object-cover transition-opacity duration-1000 ${
          state === "live" ? "opacity-80" : "opacity-0"
        }`}
      />
      {state !== "live" && (
        <div className="ambient-backdrop absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-white/25">
            {state === "pending" ? "Waking up the camera…" : "Camera off — Thread is still listening"}
          </p>
        </div>
      )}
      <div className="camera-vignette pointer-events-none absolute inset-0" />
    </div>
  );
}
