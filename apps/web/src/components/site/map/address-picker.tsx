"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ADDRESS_LABELS, type AddressInput } from "@seiketsu/core/address";
import { checkDelivery, type DeliveryZone, type LatLng } from "@seiketsu/core/delivery-zones";
import { formatINR } from "@/lib/format";
import { useModal } from "../use-modal";
import { MapView, type MapHandle } from "./map-view";
import { PlaceSearch, type Place } from "./place-search";

export type PickerStore = {
  zones: DeliveryZone[];
  location: LatLng | null;
  deliveryPincodes: string[];
  deliveryFeePaise: number;
  minOrderPaise: number;
};

export type PickedAddress = AddressInput & { lat: number; lng: number };


/** Used only when the café's own pin is not set yet. */
const MUMBAI: LatLng = { lat: 19.076, lng: 72.8777 };

const input = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[15px] outline-none transition focus:border-berry";

type Props = {
  mode: "locate" | "address";
  store: PickerStore;
  title?: string;
  initial?: Partial<PickedAddress> | null;
  saving?: boolean;
  error?: string | null;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (a: PickedAddress) => void;
};

/**
 * Choose a delivery location: search, use the phone's GPS, or move the map under the pin. The pin decides delivery;
 * the text fields tell the rider where to go. In "address" mode it also takes flat, building and a label.
 */
export function AddressPicker({ mode, store, title, initial, saving, error, confirmLabel, onClose, onConfirm }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const map = useRef<MapHandle>(null);
  const id = useId();
  useModal(panel, true, onClose);

  const start: LatLng = initial?.lat != null && initial?.lng != null ? { lat: initial.lat, lng: initial.lng } : (store.location ?? MUMBAI);
  const [point, setPoint] = useState<LatLng>(start);
  const [place, setPlace] = useState<Place | null>(null);
  const [looking, setLooking] = useState(false);
  const [gps, setGps] = useState<"idle" | "busy" | "denied">("idle");
  const [form, setForm] = useState({
    label: initial?.label ?? "Home",
    house: initial?.house ?? "",
    building: initial?.building ?? "",
    area: initial?.area ?? "",
    landmark: initial?.landmark ?? "",
    pincode: initial?.pincode ?? "",
    city: initial?.city ?? "",
    instructions: initial?.instructions ?? "",
  });
  const [touched, setTouched] = useState(false);
  const edited = useRef({ area: !!initial?.area, pincode: !!initial?.pincode });

  // Street and area under the pin, to prefill the form. Typed values are never overwritten.
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => {
      setLooking(true);
      fetch(`/api/geo/reverse?lat=${point.lat}&lng=${point.lng}`, { signal: ctl.signal })
        .then((r) => r.json())
        .then((d: { result?: Place | null }) => {
          const p = d.result ?? null;
          setPlace(p);
          if (p)
            setForm((f) => ({
              ...f,
              area: edited.current.area ? f.area : [p.line, p.area].filter((x, i, a) => x && a.indexOf(x) === i).join(", "),
              pincode: edited.current.pincode ? f.pincode : p.pincode || f.pincode,
              city: p.city || f.city,
            }));
        })
        .catch(() => {})
        .finally(() => setLooking(false));
    }, 350);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [point]);


  function choose(p: Place) {
    map.current?.flyTo({ lat: p.lat, lng: p.lng }, 17);
  }

  function locateMe() {
    if (!navigator.geolocation) return setGps("denied");
    setGps("busy");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps("idle");
        map.current?.flyTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 17);
      },
      () => setGps("denied"),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const check = checkDelivery({
    point,
    pincode: form.pincode,
    zones: store.zones,
    outlet: store.location,
    pincodes: store.deliveryPincodes,
    storeFeePaise: store.deliveryFeePaise,
    storeMinOrderPaise: store.minOrderPaise,
  });
  const usesZones = store.zones.length > 0 && !!store.location;
  const pinOk = /^[1-9]\d{5}$/.test(form.pincode);
  const missing = mode === "address" ? (!form.house.trim() ? "house" : form.area.trim().length < 3 ? "area" : !pinOk ? "pincode" : null) : !pinOk && !usesZones ? "pincode" : null;

  function confirm() {
    setTouched(true);
    if (missing || !check.ok) return;
    onConfirm({ ...form, lat: point.lat, lng: point.lng });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (k === "area" || k === "pincode") edited.current[k] = true;
    setForm((f) => ({ ...f, [k]: k === "pincode" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value }));
  };

  // Rendered on <body>: opened from inside another sheet, a transformed parent would otherwise size and clip it.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-cream sm:h-[min(760px,90dvh)] sm:max-w-[960px] sm:rounded-3xl sm:shadow-2xl"
      >
        <header className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-6">
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-paper" aria-label="Close">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <h2 id={`${id}-t`} className="font-display text-xl text-berry">
            {title ?? (mode === "locate" ? "Where should we deliver?" : "Delivery address")}
          </h2>
        </header>

        <div className="grid min-h-0 flex-1 sm:grid-cols-[1.15fr_1fr]">
          {/* Search + map */}
          <div className="relative flex min-h-[300px] flex-col sm:min-h-0">
            <PlaceSearch floating near={store.location ?? point} onPick={choose} className="absolute inset-x-3 top-3 z-20 sm:inset-x-4" />

            <MapView ref={map} center={start} zoom={16} pin zones={store.zones} outlet={store.location} onMove={setPoint} onClick={(p) => map.current?.flyTo(p)} className="flex-1" />

            <button
              type="button"
              onClick={locateMe}
              disabled={gps === "busy"}
              className="absolute bottom-10 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-berry/30 bg-white px-4 py-2.5 text-sm font-semibold text-berry shadow-md transition hover:bg-paper disabled:opacity-70"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3.5" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
              {gps === "busy" ? "Finding you…" : gps === "denied" ? "Location is off · move the pin" : "Use my current location"}
            </button>
          </div>

          {/* Details */}
          <div className="flex min-h-0 flex-col border-t border-line bg-white sm:border-l sm:border-t-0">
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Delivering to</p>
                <p className="mt-1 font-semibold leading-snug">{looking && !place ? "Finding the address…" : place?.line || "Move the map to place the pin"}</p>
                {place && <p className="text-sm text-muted">{[place.area !== place.line ? place.area : "", place.city, place.pincode].filter(Boolean).join(", ")}</p>}
              </div>

              <div
                role="status"
                className={`flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${check.ok ? "bg-veg/10 text-veg" : "bg-nonveg/10 text-nonveg"}`}
              >
                <span className={`mt-1 size-2.5 shrink-0 rounded-full ${check.ok ? "bg-veg" : "bg-nonveg"}`} aria-hidden="true" />
                {check.ok ? (
                  <span>
                    <strong>We deliver here</strong>
                    {" · "}
                    {check.feePaise ? `${formatINR(check.feePaise)} delivery` : "free delivery"}
                    {check.etaMinutes ? ` · about ${check.etaMinutes} min` : ""}
                    {check.minOrderPaise ? ` · minimum ${formatINR(check.minOrderPaise)}` : ""}
                  </span>
                ) : check.reason === "pincode" && !pinOk ? (
                  <span>Enter the pincode to check delivery.</span>
                ) : (
                  <span>
                    <strong>We don&apos;t deliver here yet.</strong>{" "}
                    <Link href={`/coming-soon${pinOk ? `?pin=${form.pincode}` : ""}`} className="font-semibold underline" onClick={onClose}>
                      Tell us you&apos;re here
                    </Link>
                  </span>
                )}
              </div>

              {mode === "address" ? (
                <div className="space-y-3">
                  <Field label="Flat / house no. *" error={touched && missing === "house" ? "Enter your flat or house number" : null}>
                    <input value={form.house} onChange={set("house")} className={input} autoComplete="address-line1" placeholder="e.g. Flat 4B" />
                  </Field>
                  <Field label="Building / society">
                    <input value={form.building} onChange={set("building")} className={input} placeholder="e.g. Sea Breeze CHS" />
                  </Field>
                  <Field label="Street & area *" error={touched && missing === "area" ? "Enter the street or area" : null}>
                    <input value={form.area} onChange={set("area")} className={input} autoComplete="address-line2" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Landmark">
                      <input value={form.landmark} onChange={set("landmark")} className={input} placeholder="Optional" />
                    </Field>
                    <Field label="Pincode *" error={touched && missing === "pincode" ? "6 digits" : null}>
                      <input value={form.pincode} onChange={set("pincode")} className={input} inputMode="numeric" autoComplete="postal-code" />
                    </Field>
                  </div>
                  <Field label="Instructions for the rider">
                    <input value={form.instructions} onChange={set("instructions")} className={input} placeholder="Optional: gate code, floor…" />
                  </Field>
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium">Save as</legend>
                    <div className="flex flex-wrap gap-2">
                      {[...ADDRESS_LABELS, ...(ADDRESS_LABELS.includes(form.label as never) ? [] : [form.label])].map((l) => (
                        <button
                          key={l}
                          type="button"
                          aria-pressed={form.label === l}
                          onClick={() => setForm((f) => ({ ...f, label: l }))}
                          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${form.label === l ? "border-berry bg-berry text-cream" : "border-line bg-white hover:border-berry/40"}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              ) : (
                !usesZones && (
                  <Field label="Pincode" error={touched && missing === "pincode" ? "Enter a 6-digit pincode" : null}>
                    <input value={form.pincode} onChange={set("pincode")} className={input} inputMode="numeric" autoComplete="postal-code" />
                  </Field>
                )
              )}
              {error && <p role="alert" className="rounded-xl bg-nonveg/10 p-3 text-sm text-nonveg">{error}</p>}
            </div>
            <div className="border-t border-line p-4 sm:px-6">
              <button
                type="button"
                onClick={confirm}
                disabled={saving || !check.ok}
                className="w-full rounded-full bg-berry py-3.5 font-semibold text-cream transition hover:bg-berry-deep disabled:opacity-50"
              >
                {saving ? "Saving…" : confirmLabel ?? (mode === "locate" ? "Confirm location" : "Save address")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-nonveg">{error}</span>}
    </label>
  );
}
