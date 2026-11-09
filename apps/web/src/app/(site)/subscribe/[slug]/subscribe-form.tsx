"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { subscribeAction } from "./actions";

const box = "w-full rounded-xl border border-line bg-white px-3.5 py-3 outline-none focus:border-berry aria-[invalid=true]:border-nonveg";

type Defaults = { name: string; phone: string; email: string };

export function SubscribeForm({ slug, minDate, maxDate, defaults }: { slug: string; minDate: string; maxDate: string; defaults: Defaults }) {
  const [state, action, pending] = useActionState(subscribeAction, undefined);
  const err = (k: string) => state?.fields?.[k];
  const a = (k: string) => ({ "aria-invalid": !!err(k), "aria-describedby": err(k) ? `sub-${k}-err` : undefined });
  const v = (k: string, d = "") => state?.values?.[k] ?? d;
  const field = (k: string, label: string, el: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <label htmlFor={`sub-${k}`} className="block text-sm font-medium">{label}</label>
      {el}
      {err(k) ? <p id={`sub-${k}-err`} className="text-sm text-nonveg">{err(k)}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );

  return (
    <form
      action={action}
      // Submit by hand so a failed attempt keeps what was typed.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      noValidate
      className="relative space-y-4 self-start rounded-3xl border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-8"
    >
      <h2 className="font-display text-2xl">Your details</h2>
      <input type="hidden" name="slug" value={slug} />
      <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Full name", <input id="sub-name" name="name" autoComplete="name" defaultValue={v("name", defaults.name)} className={box} {...a("name")} />)}
        {field("phone", "Mobile number", <input id="sub-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v("phone", defaults.phone)} className={box} {...a("phone")} />)}
      </div>
      {field("email", "Email (optional)", <input id="sub-email" name="email" type="email" autoComplete="email" defaultValue={v("email", defaults.email)} className={box} {...a("email")} />)}
      {field("address", "Delivery address", <textarea id="sub-address" name="address" rows={3} autoComplete="street-address" defaultValue={v("address")} className={box} {...a("address")} />, "Flat, building, street and landmark")}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("pincode", "Pincode", <input id="sub-pincode" name="pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" defaultValue={v("pincode")} className={`${box} tabular`} {...a("pincode")} />)}
        {field("startDate", "Start date", <input id="sub-startDate" name="startDate" type="date" min={minDate} max={maxDate} defaultValue={v("startDate", minDate)} className={box} {...a("startDate")} />)}
      </div>
      {field("notes", "Anything we should know? (optional)", <textarea id="sub-notes" name="notes" rows={2} maxLength={500} placeholder="Allergies, no onion, delivery time, office reception…" defaultValue={v("notes")} className={box} />)}
      {state?.error && <p role="alert" className="rounded-xl bg-nonveg/10 px-4 py-3 text-sm text-nonveg">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-berry py-3.5 font-semibold text-cream shadow-[var(--shadow-float)] hover:bg-berry-deep disabled:opacity-60">
        {pending ? "Sending…" : "Request this plan"}
      </button>
      <p className="text-xs text-muted">
        Nothing is charged yet. On the next page you can pay securely online, or we’ll call to arrange payment. See our <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </form>
  );
}
