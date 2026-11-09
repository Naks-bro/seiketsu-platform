"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { isPincode, isServiceable, pickOutletForPincode } from "@seiketsu/core/delivery-area";
import { chooseOutletAction } from "@/app/(site)/outlet-actions";
import { closeLocationSheet, openLocationSheet, setLocation, useLocation } from "@/lib/location";
import { useModal } from "./use-modal";

type Outlet = { slug: string; area: string; address: string; pickupEnabled: boolean; deliveryEnabled: boolean; pincodes: string[] };
type Props = { pincodes: string[]; deliveryEnabled: boolean; pickupEnabled: boolean; pickupFrom: string; outlets?: Outlet[]; current?: string | null };

function PinIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

/** Header pill: where we are delivering, or a prompt to set it. */
export function LocationPill({ pickupFrom }: { pickupFrom: string }) {
  const { location } = useLocation();
  const label = !location ? "Check delivery" : location.mode === "pickup" ? `Pickup · ${pickupFrom}` : `Deliver to ${location.pincode}`;
  return (
    <button
      type="button"
      onClick={openLocationSheet}
      className="flex min-h-10 min-w-10 max-w-44 items-center justify-center gap-1.5 truncate rounded-full border border-cream/25 px-3 text-xs font-medium hover:bg-berry-deep sm:text-sm"
      aria-label={`${label}. Change`}
    >
      <PinIcon />
      {/* Very narrow phones show the pin alone; the label stays for screen readers. */}
      <span className="truncate max-[359px]:sr-only">{label}</span>
    </button>
  );
}

export function LocationSheet(props: Props) {
  const { sheetOpen } = useLocation();
  if (!sheetOpen) return null;
  return <Sheet {...props} />;
}

function Sheet({ pincodes, deliveryEnabled, pickupEnabled, pickupFrom, outlets = [], current = null }: Props) {
  const router = useRouter();
  const { location } = useLocation();
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const [mode, setMode] = useState<"delivery" | "pickup">(location?.mode === "pickup" || !deliveryEnabled ? "pickup" : "delivery");
  const [pin, setPin] = useState(location?.pincode ?? "");
  const [error, setError] = useState<string | null>(null);
  // With more than one outlet, the pincode decides which kitchen delivers, and pickup lets you choose.
  const many = outlets.length > 1;
  const pickupOutlets = outlets.filter((o) => o.pickupEnabled);
  const [pickupAt, setPickupAt] = useState(current ?? pickupOutlets[0]?.slug ?? null);
  const anyDelivery = many ? outlets.some((o) => o.deliveryEnabled) : deliveryEnabled;
  const anyPickup = many ? pickupOutlets.length > 0 : pickupEnabled;

  async function moveTo(slug: string | null) {
    if (slug && slug !== current) {
      await chooseOutletAction(slug);
      router.refresh();
    }
  }

  useModal(panel, true, closeLocationSheet);

  function checkPin(e: React.FormEvent) {
    e.preventDefault();
    const p = pin.trim();
    if (!isPincode(p)) return setError("Enter a 6-digit pincode, for example 400061.");
    if (many) {
      const to = pickOutletForPincode(outlets, p, current);
      if (to) {
        setLocation({ mode: "delivery", pincode: p });
        void moveTo(to.slug);
        return;
      }
    } else if (isServiceable(p, pincodes)) return setLocation({ mode: "delivery", pincode: p });
    closeLocationSheet();
    router.push(`/coming-soon?pin=${p}`);
  }

  const tab = (m: "delivery" | "pickup", label: string, enabled: boolean) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      disabled={!enabled}
      onClick={() => setMode(m)}
      className={`flex-1 rounded-full py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        mode === m ? "bg-berry text-cream shadow-sm" : "text-muted hover:text-ink"
      }`}
    >
      {label}
      {!enabled && <span className="sr-only"> (not available right now)</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center sm:items-center">
      <div aria-hidden className="animate-fade-in absolute inset-0 bg-ink/45" onClick={closeLocationSheet} />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        className="animate-sheet-up relative w-full max-w-md rounded-t-3xl bg-cream p-6 shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-olive-ink">Before you order</p>
            <h2 id={`${id}-t`} className="mt-1 font-display text-3xl leading-tight text-berry">How would you like it?</h2>
          </div>
          <button type="button" onClick={closeLocationSheet} className="min-h-10 rounded-full px-3 text-sm text-muted hover:bg-paper">
            Close
          </button>
        </div>

        <div role="tablist" aria-label="Delivery or pickup" className="mt-5 flex gap-1 rounded-full border border-line bg-white p-1">
          {tab("delivery", "Delivery", anyDelivery)}
          {tab("pickup", "Pickup", anyPickup)}
        </div>

        {mode === "delivery" ? (
          <form onSubmit={checkPin} className="mt-5 space-y-3" noValidate>
            <label htmlFor={`${id}-pin`} className="block text-sm font-medium">Your pincode</label>
            <div className="flex gap-2">
              <input
                id={`${id}-pin`}
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ""));
                  setError(null);
                }}
                placeholder="400061"
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-err` : undefined}
                className="tabular min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 text-lg tracking-[0.2em] outline-none focus:border-berry aria-[invalid=true]:border-nonveg"
              />
              <button type="submit" className="rounded-xl bg-berry px-5 font-semibold text-cream hover:bg-berry-deep">
                Check
              </button>
            </div>
            {error && <p id={`${id}-err`} role="alert" className="text-sm text-nonveg">{error}</p>}
            <p className="text-xs text-muted">We’ll check if our kitchen delivers to you. You can change this anytime.</p>
          </form>
        ) : (
          <div className="mt-5 space-y-4">
            {many ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Pick up from</legend>
                {pickupOutlets.map((o) => (
                  <label key={o.slug} className={`flex cursor-pointer items-start gap-3 rounded-2xl border bg-white p-4 ${pickupAt === o.slug ? "border-berry" : "border-line"}`}>
                    <input type="radio" name="pickup-outlet" checked={pickupAt === o.slug} onChange={() => setPickupAt(o.slug)} className="mt-1 accent-[var(--color-berry)]" />
                    <span>
                      <span className="block font-semibold">Seiketsu {o.area}</span>
                      <span className="block text-sm text-muted">{o.address}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
                <PinIcon className="mt-0.5 size-5 text-berry" />
                <div>
                  <p className="font-semibold">Pick up from Seiketsu {pickupFrom}</p>
                  <p className="text-sm text-muted">We’ll message you when it’s ready at the counter.</p>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setLocation({ mode: "pickup", pincode: null });
                if (many) void moveTo(pickupAt);
              }}
              className="w-full rounded-full bg-berry py-3.5 font-semibold text-cream hover:bg-berry-deep"
            >
              I’ll pick it up
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
