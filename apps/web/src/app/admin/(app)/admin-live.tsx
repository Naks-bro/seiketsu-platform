"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLive } from "@/lib/live";
import { useOrderAlerts } from "@/lib/order-alerts";

/**
 * Keeps admin pages fresh and alerts staff when new paid orders arrive: chime, vibration and a system
 * notification. Sound is on by default; the first tap anywhere on the page lets the browser play it.
 */
export function AdminLive({ outletId, newCount }: { outletId: string; newCount: number }) {
  const router = useRouter();
  const { sound, unlocked, permission, toggle, askPermission, alert } = useOrderAlerts();
  const last = useRef(newCount);

  useLive(`outlet-${outletId}`, () => router.refresh());

  useEffect(() => {
    const added = newCount - last.current;
    if (added > 0) void alert(added > 1 ? `${added} new orders` : "New order", "Open Seiketsu admin to accept it.");
    last.current = newCount;
  }, [newCount, alert]);

  return (
    <span className="no-print inline-flex flex-wrap items-center gap-2">
      {permission === "default" && (
        <button type="button" onClick={() => void askPermission()} className="rounded-full border border-berry/40 px-3 py-1.5 text-xs font-medium text-berry hover:bg-paper">
          Allow notifications
        </button>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={sound}
        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${sound && unlocked ? "border-veg bg-veg/10 text-veg" : sound ? "border-amber-500 bg-amber-50 text-amber-800" : "border-line text-muted"}`}
      >
        {!sound ? "Sound off" : unlocked ? "Sound on for new orders" : "Sound on · tap anywhere to start"}
      </button>
    </span>
  );
}
