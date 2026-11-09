"use client";

import Link from "next/link";
import { startTransition, useActionState } from "react";
import { CATEGORY_LABEL, TICKET_CATEGORIES, type TicketCategory } from "@seiketsu/core/tickets";
import { openTicketAction } from "./actions";

const box = "w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-berry aria-[invalid=true]:border-nonveg";

type Props = {
  defaults: { name: string; phone: string; email: string; category: TicketCategory; subject: string };
  orderToken: string | null;
  subscriptionToken: string | null;
  linkedTo: string | null;
};

export function SupportForm({ defaults, orderToken, subscriptionToken, linkedTo }: Props) {
  const [state, action, pending] = useActionState(openTicketAction, undefined);
  const err = (k: string) => state?.fields?.[k];
  const a = (k: string) => ({ "aria-invalid": !!err(k), "aria-describedby": err(k) ? `t-${k}-err` : undefined });
  const v = (k: keyof Props["defaults"] | "message") => state?.values?.[k] ?? (k === "message" ? "" : defaults[k]);
  const field = (k: string, label: string, el: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <label htmlFor={`t-${k}`} className="block text-sm font-medium">{label}</label>
      {el}
      {err(k) ? <p id={`t-${k}-err`} className="text-sm text-nonveg">{err(k)}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
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
      className="relative space-y-4 rounded-3xl border border-line bg-white p-6 shadow-[var(--shadow-card)] sm:p-8"
    >
      {orderToken && <input type="hidden" name="order" value={orderToken} />}
      {subscriptionToken && <input type="hidden" name="subscription" value={subscriptionToken} />}
      <div className="absolute -left-[9999px] size-px overflow-hidden" aria-hidden>
        <label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {linkedTo && <p className="rounded-xl bg-paper px-4 py-2.5 text-sm">About <strong>{linkedTo}</strong></p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("name", "Your name", <input id="t-name" name="name" autoComplete="name" defaultValue={v("name")} className={box} {...a("name")} />)}
        {field("phone", "Mobile number", <input id="t-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={v("phone")} className={box} {...a("phone")} />, "We reply here and on this page.")}
      </div>
      {field("email", "Email (optional)", <input id="t-email" name="email" type="email" autoComplete="email" defaultValue={v("email")} className={box} {...a("email")} />)}
      {field(
        "category",
        "What is it about?",
        <select id="t-category" name="category" defaultValue={v("category")} className={box} {...a("category")}>
          {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>,
      )}
      {field("subject", "Subject", <input id="t-subject" name="subject" maxLength={120} defaultValue={v("subject")} placeholder="e.g. Dip missing from my order" className={box} {...a("subject")} />)}
      {field("message", "Tell us what happened", <textarea id="t-message" name="message" rows={5} maxLength={2000} defaultValue={v("message")} className={box} {...a("message")} />)}
      {state?.error && <p role="alert" className="rounded-xl bg-nonveg/10 px-4 py-3 text-sm text-nonveg">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-berry py-3.5 font-semibold text-cream shadow-[var(--shadow-float)] hover:bg-berry-deep disabled:opacity-60">
        {pending ? "Sending…" : "Send to our team"}
      </button>
      <p className="text-xs text-muted">
        We only use these details to reply to you. See our <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </form>
  );
}
