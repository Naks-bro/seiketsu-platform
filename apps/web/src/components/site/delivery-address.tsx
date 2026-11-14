"use client";

import { useState } from "react";
import { addressLine } from "@seiketsu/core/address";
import { checkDelivery } from "@seiketsu/core/delivery-zones";
import { saveAddressAction } from "@/app/(site)/account/address-actions";
import { formatINR } from "@/lib/format";
import type { SavedAddress } from "@/lib/server/addresses";
import { AddressPicker, type PickedAddress, type PickerStore } from "./map/address-picker";

/** One address the order can go to: a saved one (with id) or one picked for this order only. */
export type ChosenAddress = PickedAddress & { id?: string };

const deliverable = (a: { lat: number; lng: number; pincode: string }, s: PickerStore) =>
  checkDelivery({ point: { lat: a.lat, lng: a.lng }, pincode: a.pincode, zones: s.zones, outlet: s.location, pincodes: s.deliveryPincodes, storeFeePaise: s.deliveryFeePaise, storeMinOrderPaise: s.minOrderPaise });

export function LabelIcon({ label, className = "size-5" }: { label: string; className?: string }) {
  const p = { viewBox: "0 0 24 24", className, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (label === "Home") return <svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></svg>;
  if (label === "Work") return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" /></svg>;
  return <svg {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
}

/**
 * Checkout's delivery address: saved addresses as cards for signed-in customers, or one address on the map for
 * guests. Each card shows whether we deliver there and at what fee.
 */
export function DeliveryAddress({
  store,
  signedIn,
  saved,
  value,
  onChange,
  error,
  startAt,
}: {
  /** Where the map opens for a new address, e.g. the pin chosen on the menu. */
  startAt?: { lat: number; lng: number; pincode?: string } | null;
  store: PickerStore;
  signedIn: boolean;
  saved: SavedAddress[];
  value: ChosenAddress | null;
  onChange: (a: ChosenAddress | null) => void;
  error?: string;
}) {
  const [list, setList] = useState(saved);
  const [picking, setPicking] = useState<null | { initial: Partial<ChosenAddress> | null }>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function confirm(a: PickedAddress) {
    if (!signedIn) {
      onChange(a);
      setPicking(null);
      return;
    }
    setSaving(true);
    setSaveError(null);
    const id = picking?.initial?.id;
    const r = await saveAddressAction(a, id);
    setSaving(false);
    if (!r.ok) return setSaveError(r.error);
    setList(r.addresses);
    if (r.address) onChange({ ...r.address });
    setPicking(null);
  }

  const cards: ChosenAddress[] = signedIn ? list : value ? [value] : [];

  return (
    <div className="space-y-3">
      {cards.length > 0 && (
        <div role="radiogroup" aria-label="Delivery address" className="grid gap-3 sm:grid-cols-2">
          {cards.map((a) => {
            const check = deliverable(a, store);
            const selected = value ? (a.id ? a.id === value.id : true) : false;
            return (
              <div
                key={a.id ?? "guest"}
                role="radio"
                aria-checked={selected}
                tabIndex={0}
                onClick={() => check.ok && onChange(a)}
                onKeyDown={(e) => (e.key === " " || e.key === "Enter") && check.ok && (e.preventDefault(), onChange(a))}
                className={`group relative rounded-2xl border bg-white p-4 text-left transition ${check.ok ? "cursor-pointer hover:border-berry/50" : "cursor-not-allowed opacity-70"} ${selected ? "border-berry ring-1 ring-berry" : "border-line"}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full ${selected ? "bg-berry text-cream" : "bg-paper text-berry"}`}>
                    <LabelIcon label={a.label} className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{a.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted">{addressLine({ house: a.house, building: a.building, area: a.area })}</p>
                    <p className={`mt-2 text-xs font-medium ${check.ok ? "text-veg" : "text-nonveg"}`}>
                      {check.ok
                        ? `${check.feePaise ? `${formatINR(check.feePaise)} delivery` : "Free delivery"}${check.etaMinutes ? ` · ~${check.etaMinutes} min` : ""}`
                        : "We don't deliver here yet"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPicking({ initial: a });
                  }}
                  className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold text-berry hover:bg-paper"
                >
                  Edit
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setPicking({ initial: null })}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-berry/30 bg-white/60 py-4 font-semibold text-berry transition hover:border-berry/60 hover:bg-white"
      >
        <span className="text-lg leading-none" aria-hidden="true">+</span>
        {cards.length ? "Add a new address" : "Add delivery address"}
      </button>
      {error && <p className="text-sm text-nonveg">{error}</p>}

      {picking && (
        <AddressPicker
          mode="address"
          store={store}
          initial={picking.initial ?? (startAt ? { lat: startAt.lat, lng: startAt.lng, pincode: startAt.pincode } : null)}
          saving={saving}
          error={saveError}
          confirmLabel={signedIn ? "Save & deliver here" : "Deliver here"}
          onClose={() => {
            setPicking(null);
            setSaveError(null);
          }}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}
