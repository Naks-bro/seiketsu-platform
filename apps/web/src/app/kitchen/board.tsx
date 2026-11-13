"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { Ticket } from "@/lib/server/active-orders";
import { useLive } from "@/lib/live";
import { useOrderAlerts } from "@/lib/order-alerts";
import { bumpOrderAction } from "./actions";

const COLUMNS: { key: string; title: string; statuses: Ticket["status"][] }[] = [
  { key: "new", title: "New", statuses: ["placed"] },
  { key: "making", title: "Making", statuses: ["accepted", "preparing"] },
  { key: "ready", title: "Ready", statuses: ["ready", "out_for_delivery"] },
];

/** The single next step for a ticket, as a big button. */
function nextStep(t: Ticket): { to: string; label: string } | null {
  switch (t.status) {
    case "placed":
      return { to: "accepted", label: "Accept" };
    case "accepted":
      return { to: "preparing", label: "Start making" };
    case "preparing":
      return { to: "ready", label: "Mark ready" };
    case "ready":
      return t.fulfilment === "delivery" ? { to: "out_for_delivery", label: "Sent with rider" } : { to: "completed", label: "Handed over" };
    case "out_for_delivery":
      return { to: "completed", label: "Delivered" };
    default:
      return null;
  }
}

function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function KitchenBoard({ tickets, outletId, prepMinutes, staffName }: { tickets: Ticket[]; outletId: string; prepMinutes: number; staffName: string }) {
  const router = useRouter();
  const now = useNow();
  const { sound, unlocked, permission, toggle, askPermission, alert } = useOrderAlerts();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const seen = useRef(new Set(tickets.filter((t) => t.status === "placed").map((t) => t.id)));

  useLive(`outlet-${outletId}`, () => router.refresh());

  // Chime once for every order that newly appears in "New".
  useEffect(() => {
    const fresh = tickets.filter((t) => t.status === "placed" && !seen.current.has(t.id));
    fresh.forEach((t) => seen.current.add(t.id));
    if (fresh.length) void alert(`New order${fresh.length > 1 ? `s (${fresh.length})` : ""}`, fresh.map((t) => t.orderNumber).join(", "));
  }, [tickets, alert]);

  function bump(t: Ticket, to: string) {
    setPendingId(t.id);
    setError(null);
    startTransition(async () => {
      const r = await bumpOrderAction(t.id, to);
      if (r.error) setError(`${t.orderNumber}: ${r.error}`);
      router.refresh();
      setPendingId(null);
    });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <h1 className="font-display text-2xl">Kitchen</h1>
        <span className="text-sm text-white/60">{tickets.length} open · {staffName}</span>
        <div className="ml-auto flex items-center gap-2">
          {permission === "default" && (
            <button type="button" onClick={() => void askPermission()} className="min-h-11 rounded-full bg-white/10 px-4 text-sm font-semibold hover:bg-white/20">
              Allow notifications
            </button>
          )}
          <button
            type="button"
            onClick={toggle}
            aria-pressed={sound}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${sound && unlocked ? "bg-[#2f7d32] text-white" : "bg-[#f68a31] text-[#1d1a17]"}`}
          >
            {!sound ? "Sound off" : unlocked ? "Sound on" : "Sound on · tap anywhere to start"}
          </button>
          <Link href="/admin/orders" className="min-h-11 rounded-full border border-white/20 px-4 py-2.5 text-sm hover:bg-white/10">All orders</Link>
        </div>
      </header>
      {error && <p role="alert" className="bg-[#a51c47] px-4 py-2 text-sm">{error}</p>}

      <div className="clear-badge grid flex-1 gap-4 p-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const list = tickets.filter((t) => col.statuses.includes(t.status));
          return (
            <section key={col.key} aria-labelledby={`col-${col.key}`} className="flex min-h-40 flex-col rounded-2xl bg-white/5 p-3">
              <h2 id={`col-${col.key}`} className="mb-3 flex items-center justify-between px-1 text-sm font-semibold text-white/70">
                {col.title} <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-base tabular-nums text-white">{list.length}</span>
              </h2>
              {list.length === 0 ? (
                <p className="px-1 text-sm text-white/40">Nothing here.</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((t) => {
                    const mins = Math.max(0, Math.floor((now - new Date(t.placedAt).getTime()) / 60_000));
                    const late = col.key !== "ready" && mins >= prepMinutes;
                    const step = nextStep(t);
                    return (
                      <li key={t.id} className={`rounded-xl bg-[#fffcf5] p-4 text-[#1d1a17] ${late ? "ring-4 ring-[#e04d75]" : ""}`}>
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div>
                            <p className="text-2xl font-bold tabular-nums">{t.orderNumber.replace("SK-", "#")}</p>
                            <p className="text-sm text-[#6b6157]">
                              {t.customerName}
                              {t.tableLabel ? ` · ${t.tableLabel}` : ""} · {t.fulfilment === "delivery" ? "Delivery" : t.source === "pos" ? "Counter" : "Pickup"}
                            </p>
                          </div>
                          <p className={`rounded-lg px-2 py-1 text-lg font-bold tabular-nums ${late ? "bg-[#e04d75] text-white" : "bg-[#f3ece0]"}`} aria-label={`${mins} minutes since order`}>
                            {mins}m
                          </p>
                        </div>
                        <ul className="space-y-1.5 border-t border-[#e8dfd2] pt-2">
                          {t.items.map((i) => (
                            <li key={i.id}>
                              <p className="text-lg font-semibold leading-snug">
                                <span className="tabular-nums">{i.quantity}×</span> {i.name}
                                {i.variant && <span className="font-normal text-[#6b6157]"> · {i.variant}</span>}
                              </p>
                              {i.addons.length > 0 && <p className="text-sm">+ {i.addons.join(", ")}</p>}
                              {i.note && <p className="mt-0.5 rounded bg-[#fce9ab] px-2 py-0.5 text-sm font-medium">Note: {i.note}</p>}
                            </li>
                          ))}
                        </ul>
                        {t.notes && <p className="mt-2 rounded bg-[#fce9ab] px-2 py-1 text-sm font-medium">Order note: {t.notes}</p>}
                        {step && (
                          <button
                            type="button"
                            disabled={pendingId === t.id}
                            onClick={() => bump(t, step.to)}
                            className="mt-3 min-h-12 w-full rounded-xl bg-[#a51c47] text-lg font-semibold text-white hover:bg-[#8a1739] disabled:opacity-60"
                          >
                            {pendingId === t.id ? "Updating…" : step.label}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}