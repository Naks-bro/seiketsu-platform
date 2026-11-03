"use client";

import { useActionState, useState } from "react";
import { btnPrimary, field, panel } from "@/components/admin/ui";
import { saveCouponAction } from "../../../coupon-actions";

type Fields = {
  id: string;
  code: string;
  description: string;
  kind: "percent" | "flat";
  value: number;
  minSubtotal: number | "";
  maxDiscount: number | "";
  startsAt: string;
  endsAt: string;
  usageLimit: number | "";
  perCustomerLimit: number | "";
  firstOrderOnly: boolean;
  isActive: boolean;
};

export function CouponForm({ coupon }: { coupon: Fields | null }) {
  const [state, action, pending] = useActionState(saveCouponAction, undefined);
  const [kind, setKind] = useState<"percent" | "flat">(coupon?.kind ?? "percent");
  const err = (k: string) => state?.fields?.[k];
  const L = (k: string, text: string, el: React.ReactNode, hint?: string) => (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{text}</span>
      {el}
      {err(k) ? <span className="block text-nonveg">{err(k)}</span> : hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-2">
      {coupon && <input type="hidden" name="id" value={coupon.id} />}
      <section className={`${panel} space-y-4`}>
        {L("code", "Code", <input name="code" defaultValue={coupon?.code} required className={`${field} font-mono uppercase`} />, "What customers type, e.g. WELCOME10")}
        {L("description", "Note for your team (optional)", <input name="description" defaultValue={coupon?.description} maxLength={140} className={field} />)}
        <fieldset>
          <legend className="text-sm font-medium">Discount</legend>
          <div className="mt-2 flex gap-4 text-sm">
            {(["percent", "flat"] as const).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} /> {k === "percent" ? "Percentage" : "Fixed amount"}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          {L("value", kind === "percent" ? "Percent off" : "Amount off (₹)", <input name="value" type="number" min={1} step="1" defaultValue={coupon?.value ?? ""} className={field} />)}
          {kind === "percent" && L("maxDiscount", "Up to (₹, optional)", <input name="maxDiscount" type="number" min={0} defaultValue={coupon?.maxDiscount ?? ""} className={field} />)}
        </div>
        {L("minSubtotal", "Minimum order (₹, optional)", <input name="minSubtotal" type="number" min={0} defaultValue={coupon?.minSubtotal ?? ""} className={field} />)}
      </section>
      <section className={`${panel} space-y-4`}>
        <div className="grid grid-cols-2 gap-3">
          {L("startsAt", "Starts (optional)", <input name="startsAt" type="datetime-local" defaultValue={coupon?.startsAt} className={field} />)}
          {L("endsAt", "Ends (optional)", <input name="endsAt" type="datetime-local" defaultValue={coupon?.endsAt} className={field} />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {L("usageLimit", "Total uses (optional)", <input name="usageLimit" type="number" min={1} defaultValue={coupon?.usageLimit ?? ""} className={field} />, "Empty = no limit")}
          {L("perCustomerLimit", "Uses per customer", <input name="perCustomerLimit" type="number" min={1} defaultValue={coupon ? coupon.perCustomerLimit : 1} className={field} />, "Empty = no limit")}
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="firstOrderOnly" defaultChecked={coupon?.firstOrderOnly ?? false} className="mt-0.5 size-4 accent-[var(--color-berry)]" />
          <span><strong>First order only</strong><span className="block text-muted">For phone numbers that have never paid for an order.</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={coupon?.isActive ?? true} className="mt-0.5 size-4 accent-[var(--color-berry)]" />
          <span><strong>Coupon is on</strong><span className="block text-muted">Untick to stop it working without deleting it.</span></span>
        </label>
        {state?.error && <p role="alert" className="rounded-xl bg-nonveg/10 px-4 py-3 text-sm text-nonveg">{state.error}</p>}
        <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>{pending ? "Saving…" : "Save coupon"}</button>
      </section>
    </form>
  );
}
