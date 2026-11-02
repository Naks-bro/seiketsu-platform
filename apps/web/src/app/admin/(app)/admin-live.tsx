"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLive } from "@/lib/live";

/**
 * Keeps admin pages fresh and chimes when new paid orders arrive.
 * Browsers only allow sound after a click, so staff tap "Turn on sound" once per shift.
 */
export function AdminLive({ outletId, newCount }: { outletId: string; newCount: number }) {
  const router = useRouter();
  const [sound, setSound] = useState(false);
  const ctx = useRef<AudioContext | null>(null);
  const last = useRef(newCount);

  useLive(`outlet-${outletId}`, () => router.refresh());

  useEffect(() => {
    if (newCount > last.current && sound && ctx.current) {
      const c = ctx.current;
      for (const [i, f] of [880, 1175].entries()) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.2, c.currentTime + i * 0.18);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.18 + 0.3);
        o.connect(g).connect(c.destination);
        o.start(c.currentTime + i * 0.18);
        o.stop(c.currentTime + i * 0.18 + 0.3);
      }
    }
    last.current = newCount;
  }, [newCount, sound]);

  return (
    <button
      type="button"
      onClick={() => {
        ctx.current ??= new AudioContext();
        void ctx.current.resume();
        setSound((s) => !s);
      }}
      className={`no-print rounded-full border px-3 py-1.5 text-xs font-medium ${sound ? "border-veg bg-veg/10 text-veg" : "border-line text-muted"}`}
    >
      {sound ? "Sound on for new orders" : "Turn on sound"}
    </button>
  );
}