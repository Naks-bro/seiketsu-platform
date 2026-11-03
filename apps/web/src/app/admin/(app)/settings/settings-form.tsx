"use client";

import { useActionState } from "react";
import type { WeeklyHours } from "@seiketsu/core/store-hours";
import { DAY_NAMES } from "@seiketsu/core/store-hours";
import { saveSettingsAction } from "../../actions";

type Settings = {
  hours: WeeklyHours | null;
  temporarilyClosed: boolean;
  closureMessage: string;
  announcement: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  pincodeCount: number;
  loyaltyEnabled: boolean;
  loyaltyEarnPer100: number;
  loyaltyPointValue: number;
  loyaltyMinRedeem: number;
  loyaltyMaxRedeemPercent: number;
  deliveryFee: number;
  freeDeliveryAbove: number | "";
  minOrder: number;
  prepTime: number;
  taxEnabled: boolean;
  taxRate: number;
  taxInclusive: boolean;
  gstin: string;
};

const box = "rounded-lg border border-line bg-white px-3 py-2";
const section = "space-y-4 rounded-2xl border border-line bg-white p-5";

function Check({ name, label, defaultChecked, disabled }: { name: string; label: string; defaultChecked: boolean; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} disabled={disabled} className="size-4 accent-[var(--color-berry)]" />
      {label}
    </label>
  );
}

export function SettingsForm({ settings: s, canEditTax }: { settings: Settings; canEditTax: boolean }) {
  const [state, action, pending] = useActionState(saveSettingsAction, undefined);
  return (
    <form action={action} className="space-y-5">
      <fieldset className={section}>
        <legend className="px-1 font-display text-xl">Opening hours</legend>
        {!s.hours && <p className="rounded-lg bg-butter/60 p-2 text-sm">Hours are not set yet, so online ordering is closed. Set them below.</p>}
        <div className="space-y-2">
          {DAY_NAMES.map((day, d) => {
            const h = s.hours?.[d];
            return (
              <div key={day} className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex w-32 items-center gap-2">
                  <input type="checkbox" name={`open_${d}`} defaultChecked={s.hours ? !!h : true} className="size-4 accent-[var(--color-berry)]" />
                  {day}
                </label>
                <input type="time" name={`from_${d}`} defaultValue={h?.open ?? "08:00"} className={box} aria-label={`${day} opens`} />
                <span className="text-muted">to</span>
                <input type="time" name={`to_${d}`} defaultValue={h?.close ?? "22:00"} className={box} aria-label={`${day} closes`} />
              </div>
            );
          })}
        </div>
        <Check name="temporarilyClosed" label="Closed temporarily (stops online orders now)" defaultChecked={s.temporarilyClosed} />
        <label className="block text-sm">
          <span className="font-medium">Closure message</span>
          <input name="closureMessage" defaultValue={s.closureMessage} maxLength={200} placeholder="e.g. Closed today for maintenance. Back tomorrow at 8 am." className={`${box} mt-1 w-full`} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Announcement bar</span>
          <input name="announcement" defaultValue={s.announcement} maxLength={200} className={`${box} mt-1 w-full`} />
        </label>
      </fieldset>

      <fieldset className={section}>
        <legend className="px-1 font-display text-xl">Pickup and delivery</legend>
        <Check name="pickupEnabled" label="Accept pickup orders" defaultChecked={s.pickupEnabled} />
        <Check name="deliveryEnabled" label="Accept delivery orders" defaultChecked={s.deliveryEnabled} />
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm"><span className="font-medium">Delivery fee (₹)</span><input name="deliveryFee" type="number" min={0} step="1" defaultValue={s.deliveryFee} className={`${box} mt-1 w-full`} /></label>
          <label className="text-sm"><span className="font-medium">Free delivery above (₹)</span><input name="freeDeliveryAbove" type="number" min={0} step="1" defaultValue={s.freeDeliveryAbove} placeholder="Never" className={`${box} mt-1 w-full`} /></label>
          <label className="text-sm"><span className="font-medium">Minimum order (₹)</span><input name="minOrder" type="number" min={0} step="1" defaultValue={s.minOrder} className={`${box} mt-1 w-full`} /></label>
        </div>
        <p className="text-sm">
          <span className="font-medium">Delivery pincodes: </span>
          {s.pincodeCount ? `${s.pincodeCount} set` : "none set, so any pincode is accepted"} ·{" "}
          <a href="/admin/delivery-areas" className="font-medium text-berry hover:underline">Manage delivery areas</a>
        </p>
        <label className="block text-sm sm:w-48">
          <span className="font-medium">Typical prep time (minutes)</span>
          <input name="prepTime" type="number" min={5} max={180} defaultValue={s.prepTime} className={`${box} mt-1 w-full`} />
        </label>
      </fieldset>

      <fieldset className={section}>
        <legend className="px-1 font-display text-xl">Loyalty points</legend>
        <Check name="loyaltyEnabled" label="Give and accept loyalty points" defaultChecked={s.loyaltyEnabled} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm"><span className="font-medium">Points per ₹100 spent</span><input name="loyaltyEarnPer100" type="number" min={0} step="1" defaultValue={s.loyaltyEarnPer100} className={`${box} mt-1 w-full`} /></label>
          <label className="text-sm"><span className="font-medium">1 point is worth (₹)</span><input name="loyaltyPointValue" type="number" min={0} step="0.01" defaultValue={s.loyaltyPointValue} className={`${box} mt-1 w-full`} /></label>
          <label className="text-sm"><span className="font-medium">Spend from (points)</span><input name="loyaltyMinRedeem" type="number" min={0} step="1" defaultValue={s.loyaltyMinRedeem} className={`${box} mt-1 w-full`} /></label>
          <label className="text-sm"><span className="font-medium">Points pay up to (% of order)</span><input name="loyaltyMaxRedeemPercent" type="number" min={0} max={100} step="1" defaultValue={s.loyaltyMaxRedeemPercent} className={`${box} mt-1 w-full`} /></label>
        </div>
        <p className="text-xs text-muted">Points are earned on food paid for (after coupons), added once the payment goes through and taken back if the order is refunded. Customers must be signed in to spend them.</p>
      </fieldset>

      <fieldset className={section} disabled={!canEditTax}>
        <legend className="px-1 font-display text-xl">GST</legend>
        <p className="text-sm text-muted">Set these with your accountant. {canEditTax ? "" : "Only the owner can change tax settings."}</p>
        <Check name="taxEnabled" label="Charge GST on online orders" defaultChecked={s.taxEnabled} disabled={!canEditTax} />
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm"><span className="font-medium">GST rate (%)</span><input name="taxRate" type="number" min={0} max={28} step="0.01" defaultValue={s.taxRate} className={`${box} mt-1 w-full`} /></label>
          <label className="text-sm"><span className="font-medium">GSTIN</span><input name="gstin" defaultValue={s.gstin} maxLength={15} className={`${box} mt-1 w-full uppercase`} /></label>
        </div>
        <Check name="taxInclusive" label="Menu prices already include GST" defaultChecked={s.taxInclusive} disabled={!canEditTax} />
      </fieldset>

      <div className="sticky bottom-0 flex items-center gap-4 border-t border-line bg-[#fbf8f2] py-3">
        <button type="submit" disabled={pending} className="rounded-full bg-berry px-6 py-2.5 font-semibold text-cream hover:bg-berry-deep disabled:opacity-60">
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state?.error && <p role="alert" className="text-sm text-nonveg">{state.error}</p>}
        {state?.ok && <p role="status" className="text-sm text-veg">{state.ok}</p>}
      </div>
    </form>
  );
}