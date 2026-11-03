"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestAreaAction } from "./actions";

const box = "w-full rounded-xl border border-line bg-white px-3.5 py-3 outline-none focus:border-berry aria-[invalid=true]:border-nonveg";

export function AreaForm({ pin }: { pin: string }) {
  const [state, action, pending] = useActionState(requestAreaAction, undefined);
  const err = (k: string) => state?.fields?.[k];
  const a = (k: string) => ({ "aria-invalid": !!err(k), "aria-describedby": err(k) ? `${k}-err` : undefined });

  if (state?.ok) {
    return (
      <div role="status" className="animate-sheet-up rounded-3xl border border-veg/30 bg-white p-8 text-center shadow-[var(--shadow-card)]">
        <p className="mx-auto grid size-14 place-items-center rounded-full bg-veg/10 text-2xl text-veg" aria-hidden>✓</p>
        <h2 className="mt-4 font-display text-3xl text-berry">Thank you, we’ve noted it.</h2>
        <p className="mx-auto mt-2 max-w-sm text-muted">
          Every request helps us decide where to go next. We’ll message you as soon as Seiketsu reaches your neighbourhood.
        </p>
        <Link href="/menu" className="mt-6 inline-block rounded-full bg-berry px-6 py-3 font-semibold text-cream hover:bg-berry-deep">
          Browse the menu meanwhile
        </Link>
      </div>
    );
  }

  const field = (k: string, label: string, el: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <label htmlFor={k} className="block text-sm font-medium">{label}</label>
      {el}
      {err(k) ? <p id={`${k}-err`} className="text-sm text-nonveg">{err(k)}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );

  return (
    <form action={action} noValidate className="relative space-y-4 rounded-3xl border border-line bg-white/80 p-6 shadow-[var(--shadow-card)] sm:p-8">
      <h2 className="font-display text-2xl text-ink">Tell us where you are</h2>
      {/* Honeypot: hidden from people and screen readers. */}
      <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Your name", <input id="name" name="name" autoComplete="name" className={box} {...a("name")} />)}
        {field("phone", "Mobile number", <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" className={box} {...a("phone")} />)}
      </div>
      {field("area", "Area, locality or society", <input id="area" name="area" autoComplete="address-level3" placeholder="e.g. your locality or society" className={box} {...a("area")} />)}
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        {field("pincode", "Pincode", <input id="pincode" name="pincode" inputMode="numeric" maxLength={6} defaultValue={pin} autoComplete="postal-code" className={`${box} tabular`} {...a("pincode")} />)}
        {field("email", "Email (optional)", <input id="email" name="email" type="email" autoComplete="email" className={box} {...a("email")} />)}
      </div>
      {field("note", "Anything else? (optional)", <textarea id="note" name="note" rows={2} maxLength={300} placeholder="Office lunches, weekly orders, a favourite dish…" className={box} />)}
      {state?.error && <p role="alert" className="rounded-xl bg-nonveg/10 px-4 py-3 text-sm text-nonveg">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-berry py-3.5 font-semibold text-cream shadow-[var(--shadow-float)] hover:bg-berry-deep disabled:opacity-60">
        {pending ? "Sending…" : "Notify me when you arrive"}
      </button>
      <p className="text-xs text-muted">
        We’ll only use this to tell you when we deliver to your area. See our <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </form>
  );
}
