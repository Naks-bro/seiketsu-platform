"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useCart } from "@/lib/cart";
import type { Reorder } from "@/lib/reorder";
import { useModal } from "./use-modal";

type Step = { kind: "idle" } | { kind: "loading" } | { kind: "choose"; r: Reorder } | { kind: "done"; r: Reorder; mode: "add" | "replace" } | { kind: "none"; r: Reorder } | { kind: "error"; message: string };

/**
 * "Order again": checks the past order against today's menu, asks whether to add to or replace a cart that already
 * has things in it, then says exactly what was added, what isn't available and what changed. Payment still happens
 * at checkout as usual.
 */
export function ReorderButton({ token, variant = "solid" }: { token: string; variant?: "solid" | "outline" | "link" }) {
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const { lines, add, clear } = useCart();

  async function start() {
    setStep({ kind: "loading" });
    try {
      const res = await fetch(`/api/orders/${token}/reorder`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setStep({ kind: "error", message: data.error ?? "Something went wrong. Please try again." });
      const r = data as Reorder;
      if (!r.lines.length) return setStep({ kind: "none", r });
      if (lines.length) return setStep({ kind: "choose", r });
      apply(r, "add");
    } catch {
      setStep({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  function apply(r: Reorder, mode: "add" | "replace") {
    if (mode === "replace") clear();
    for (const l of r.lines) add(l);
    setStep({ kind: "done", r, mode });
  }

  const style =
    variant === "link"
      ? "text-sm font-semibold text-berry hover:underline"
      : variant === "outline"
        ? "rounded-full border border-berry/40 bg-white px-4 py-2 text-sm font-semibold text-berry hover:bg-paper"
        : "rounded-full bg-berry px-5 py-2.5 text-sm font-semibold text-cream hover:bg-berry-deep";

  return (
    <>
      <button type="button" onClick={start} disabled={step.kind === "loading"} className={`${style} inline-flex items-center gap-2 disabled:opacity-60`}>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
        </svg>
        {step.kind === "loading" ? "Checking today's menu…" : "Order again"}
      </button>
      {step.kind !== "idle" && step.kind !== "loading" && <Dialog step={step} cartCount={lines.length} onApply={apply} onClose={() => setStep({ kind: "idle" })} />}
    </>
  );
}

function Dialog({ step, cartCount, onApply, onClose }: { step: Exclude<Step, { kind: "idle" } | { kind: "loading" }>; cartCount: number; onApply: (r: Reorder, m: "add" | "replace") => void; onClose: () => void }) {
  const router = useRouter();
  const { setDrawerOpen } = useCart();
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useModal(panel, true, onClose);
  const r = "r" in step ? step.r : null;
  const dishes = r ? r.lines.reduce((s, l) => s + l.quantity, 0) : 0;

  const title =
    step.kind === "choose" ? "Your cart already has items" : step.kind === "done" ? `Added ${dishes} item${dishes === 1 ? "" : "s"} to your cart` : step.kind === "none" ? "None of these are on the menu today" : "Couldn't order again";

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream p-6 shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-full ${step.kind === "done" ? "bg-veg text-white" : step.kind === "choose" ? "bg-berry/10 text-berry" : "bg-nonveg/10 text-nonveg"}`}>
            {step.kind === "done" ? (
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            ) : (
              <span className="font-display text-lg" aria-hidden="true">{step.kind === "choose" ? cartCount : "!"}</span>
            )}
          </span>
          <h2 id={`${id}-t`} className="pt-1 font-display text-2xl leading-tight text-berry">
            {title}
          </h2>
        </div>

        {step.kind === "choose" && (
          <>
            <p className="mt-3 text-sm text-muted">Add this order to what&apos;s already there, or start a fresh cart with just this order?</p>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={() => onApply(step.r, "add")} className="rounded-full bg-berry py-3 font-semibold text-cream hover:bg-berry-deep">
                Add to my cart
              </button>
              <button type="button" onClick={() => onApply(step.r, "replace")} className="rounded-full border border-line bg-white py-3 font-semibold hover:bg-paper">
                Replace my cart
              </button>
              <button type="button" onClick={onClose} className="py-2 text-sm text-muted hover:text-ink">
                Cancel
              </button>
            </div>
          </>
        )}

        {step.kind === "done" && (
          <>
            <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
              {step.r.lines.map((l) => (
                <li key={`${l.variantId}-${l.addOnIds.join("+")}`} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium">{l.name}</span>
                    {l.variantLabel && <span className="text-muted"> · {l.variantLabel}</span>}
                    {l.addOns.length > 0 && <span className="block truncate text-xs text-muted">+ {l.addOns.map((a) => a.name).join(", ")}</span>}
                  </span>
                  <span className="shrink-0 tabular text-muted">× {l.quantity}</span>
                </li>
              ))}
            </ul>
            <Notes r={step.r} />
            <p className="mt-3 text-xs text-muted">Prices are today&apos;s. {step.mode === "replace" ? "Your earlier cart was cleared." : ""} Review everything before you pay.</p>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={() => (onClose(), router.push("/checkout"))} className="rounded-full bg-berry py-3 font-semibold text-cream hover:bg-berry-deep">
                Go to checkout
              </button>
              <button type="button" onClick={() => (onClose(), setDrawerOpen(true))} className="rounded-full border border-line bg-white py-3 font-semibold hover:bg-paper">
                Review cart
              </button>
            </div>
          </>
        )}

        {step.kind === "none" && (
          <>
            <Notes r={step.r} />
            <div className="mt-5 grid gap-2">
              <Link href="/menu" onClick={onClose} className="rounded-full bg-berry py-3 text-center font-semibold text-cream hover:bg-berry-deep">
                See today&apos;s menu
              </Link>
              <button type="button" onClick={onClose} className="py-2 text-sm text-muted hover:text-ink">
                Close
              </button>
            </div>
          </>
        )}

        {step.kind === "error" && (
          <>
            <p className="mt-3 text-sm text-muted">{step.message}</p>
            <button type="button" onClick={onClose} className="mt-5 w-full rounded-full border border-line bg-white py-3 font-semibold hover:bg-paper">
              Close
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Notes({ r }: { r: Reorder }) {
  if (!r.unavailable.length && !r.changes.length) return null;
  return (
    <div className="mt-4 space-y-2 rounded-2xl bg-butter/50 p-4 text-sm">
      {r.unavailable.map((u) => (
        <p key={u.name}>
          <strong>{u.name}</strong> wasn&apos;t added: {u.reason}.
        </p>
      ))}
      {r.changes.map((c) => (
        <p key={c}>{c}</p>
      ))}
    </div>
  );
}
