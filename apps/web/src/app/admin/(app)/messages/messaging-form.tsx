"use client";

import { useActionState } from "react";
import type { MessagingSettings } from "@seiketsu/core/messaging";
import { saveMessagingAction } from "../../messaging-actions";

const box = "w-full rounded-lg border border-line bg-white px-3 py-2";
const section = "space-y-4 rounded-2xl border border-line bg-white p-5";

const UPDATES: [keyof MessagingSettings["customerUpdates"], string][] = [
  ["placed", "Order confirmed (with bill link)"],
  ["ready", "Ready for pickup"],
  ["out_for_delivery", "Out for delivery"],
  ["completed", "Completed / thank you"],
  ["cancelled", "Cancelled or rejected"],
  ["refunded", "Refund started"],
];

const RATES: [keyof MessagingSettings["rates"], string][] = [
  ["sms", "SMS (any)"],
  ["whatsappAuthentication", "WhatsApp login code"],
  ["whatsappUtility", "WhatsApp order update"],
  ["whatsappMarketing", "WhatsApp offer"],
  ["email", "Email"],
];

const toRupees = (milliPaise: number) => String(+(milliPaise / 100_000).toFixed(4));

export function MessagingForm({ s }: { s: MessagingSettings }) {
  const [state, action, pending] = useActionState(saveMessagingAction, undefined);
  return (
    <form action={action} className="grid gap-5 lg:grid-cols-2">
      <fieldset className={section}>
        <legend className="px-1 font-display text-xl">Customer updates</legend>
        <p className="text-sm text-muted">Sent on WhatsApp. Each one costs money, so keep only the ones customers need.</p>
        {UPDATES.map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={`update_${k}`} defaultChecked={s.customerUpdates[k]} className="size-4 accent-[var(--color-berry)]" />
            {label}
          </label>
        ))}
        <label className="flex items-center gap-2 border-t border-line pt-3 text-sm">
          <input type="checkbox" name="smsFallback" defaultChecked={s.smsFallback} className="size-4 accent-[var(--color-berry)]" />
          Send by SMS when WhatsApp fails
        </label>
      </fieldset>

      <fieldset className={section}>
        <legend className="px-1 font-display text-xl">Budgets & alerts</legend>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="space-y-1">Daily budget (₹)<input name="dailyBudget" inputMode="decimal" defaultValue={s.dailyBudgetPaise ? s.dailyBudgetPaise / 100 : ""} placeholder="No limit" className={box} /></label>
          <label className="space-y-1">Monthly budget (₹)<input name="monthlyBudget" inputMode="decimal" defaultValue={s.monthlyBudgetPaise ? s.monthlyBudgetPaise / 100 : ""} placeholder="No limit" className={box} /></label>
        </div>
        <p className="text-xs text-muted">At 80% you get an alert. At 100%, order updates pause until the next day or month. Login codes always go out.</p>
        <label className="block space-y-1 text-sm">Alert email<input name="alertEmail" type="email" defaultValue={s.alertEmail ?? ""} className={box} /></label>
        <label className="block space-y-1 text-sm">Alert WhatsApp number<input name="alertWhatsapp" inputMode="numeric" defaultValue={s.alertWhatsapp ?? ""} className={box} /></label>
      </fieldset>

      <fieldset className={`${section} lg:col-span-2`}>
        <legend className="px-1 font-display text-xl">Cost per message (₹, estimate)</legend>
        <p className="text-sm text-muted">Used to estimate spend. Copy the per-message rates from Meta&apos;s WhatsApp pricing for India.</p>
        <div className="grid gap-3 text-sm sm:grid-cols-5">
          {RATES.map(([k, label]) => (
            <label key={k} className="space-y-1">{label}<input name={`rate_${k}`} inputMode="decimal" defaultValue={toRupees(s.rates[k])} className={box} /></label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3 lg:col-span-2">
        <button type="submit" disabled={pending} className="rounded-full bg-berry px-6 py-2.5 font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
          {pending ? "Saving…" : "Save messaging settings"}
        </button>
        {state?.ok && <span className="text-sm text-olive-ink">{state.ok}</span>}
        {state?.error && <span role="alert" className="text-sm text-nonveg">{state.error}</span>}
      </div>
    </form>
  );
}