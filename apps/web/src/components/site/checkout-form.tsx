"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { computeQuote, type Fulfilment } from "@seiketsu/core/pricing";
import { formatHours, istDayIndex } from "@seiketsu/core/store-hours";
import type { CategoryDTO, StoreDTO } from "@/lib/types";
import { formatINR, whatsappLink } from "@/lib/format";
import { orderSource, unitTotal, useCart } from "@/lib/cart";
import { DietMark } from "@/components/diet-mark";
import { usePayment, type PaymentParams } from "./use-payment";
import { isPincode, isServiceable } from "@seiketsu/core/delivery-area";
import { useLocation } from "@/lib/location";

type FieldErrors = Record<string, string>;
type Rewards = { couponPaise: number; couponCode: string | null; couponError: string | null; loyalty: null | { balance: number; points: number; valuePaise: number } };

const input = "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 outline-none focus:border-berry aria-[invalid=true]:border-nonveg";

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-nonveg">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

type SignedIn = { name: string; phone: string; email: string | null; marketingWhatsapp: boolean; marketingEmail: boolean } | null;

export function CheckoutForm({ store, menu, customer }: { store: StoreDTO; menu: CategoryDTO[]; customer: SignedIn }) {
  const router = useRouter();
  const { lines, ready, reconcile, clear, removedNames: removed } = useCart();
  const [fulfilment, setFulfilment] = useState<Fulfilment>(store.pickupEnabled ? "pickup" : "delivery");
  const { location } = useLocation();
  const [prefilled, setPrefilled] = useState(false);
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    phone: customer?.phone ?? "",
    email: customer?.email ?? "",
    line1: "",
    landmark: "",
    pincode: "",
    instructions: "",
    notes: "",
  });
  const [marketing, setMarketing] = useState({ whatsapp: false, email: false });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const { start, dialog } = usePayment(`Order ${orderNumber}`);

  // Start from the delivery/pickup choice made on the menu (once it has loaded from storage).
  if (location && !prefilled) {
    setPrefilled(true);
    if (location.mode === "delivery" && store.deliveryEnabled) {
      setFulfilment("delivery");
      setForm((f) => ({ ...f, pincode: location.pincode }));
    } else if (location.mode === "pickup" && store.pickupEnabled) {
      setFulfilment("pickup");
    }
  }
  const pinOutside = fulfilment === "delivery" && isPincode(form.pincode) && !isServiceable(form.pincode, store.deliveryPincodes);

  useEffect(() => {
    if (ready) reconcile(menu);
  }, [ready, menu, reconcile]);

  // Coupon and points: previewed from the server here, worked out again by the server at checkout.
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const [rewards, setRewards] = useState<Rewards | null>(null);
  const fullPhone = /^\d{10}$/.test(form.phone) ? form.phone : "";
  const cartKey = JSON.stringify(lines.map((l) => [l.menuItemId, l.variantId, l.addOnIds, l.quantity]));
  useEffect(() => {
    if (!ready || cartKey === "[]") return;
    const ctl = new AbortController();
    const cart = JSON.parse(cartKey) as [string, string, string[], number][];
    fetch("/api/checkout/rewards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctl.signal,
      body: JSON.stringify({
        lines: cart.map(([menuItemId, variantId, addOnIds, quantity]) => ({ menuItemId, variantId, addOnIds, quantity })),
        phone: fullPhone,
        couponCode: coupon || undefined,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Rewards | null) => setRewards(d))
      .catch(() => {});
    return () => ctl.abort();
  }, [ready, cartKey, coupon, fullPhone]);
  const couponPaise = coupon && rewards?.couponCode ? rewards.couponPaise : 0;
  const pointsPaise = usePoints && rewards?.loyalty ? rewards.loyalty.valuePaise : 0;

  const quote = useMemo(() => {
    if (lines.length === 0) return null;
    return computeQuote(
      lines.map((l) => ({ unitPricePaise: l.unitPricePaise, addOnPricesPaise: l.addOns.map((a) => a.pricePaise), quantity: l.quantity })),
      store.pricing,
      fulfilment,
      couponPaise + pointsPaise,
    );
  }, [lines, store.pricing, fulfilment, couponPaise, pointsPaise]);

  const canOrder = store.isOpenNow && store.paymentsMode !== "disabled";
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const err = (k: string) => errors[k];
  const aria = (k: string) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k.replace(/\./g, "-")}-error` : undefined });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({ menuItemId: l.menuItemId, variantId: l.variantId, addOnIds: l.addOnIds, quantity: l.quantity, note: l.note })),
          customer: { name: form.name, phone: form.phone, email: form.email },
          fulfilment,
          address:
            fulfilment === "delivery"
              ? { line1: form.line1, landmark: form.landmark || undefined, pincode: form.pincode, instructions: form.instructions || undefined }
              : undefined,
          notes: form.notes || undefined,
          source: orderSource(),
          marketing,
          couponCode: couponPaise ? coupon : undefined,
          usePoints: pointsPaise > 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const fe: FieldErrors = {};
        for (const [k, v] of Object.entries((data.fieldErrors ?? {}) as FieldErrors)) fe[k] = v;
        setErrors(fe);
        setFormError(data.error ?? "Something went wrong.");
        return;
      }
      const { token, payment, orderNumber: num } = data as { token: string; payment: PaymentParams; orderNumber: string };
      setOrderNumber(num);
      const outcome = await start(payment, token);
      if (outcome === "paid" || outcome === "pending") clear();
      router.push(`/order/${token}`);
    } catch {
      setFormError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p className="text-muted">Loading your cart…</p>;

  if (lines.length === 0) {
    return (
      <div className="space-y-4 py-10 text-center">
        {removed.length > 0 && <p className="text-sm text-nonveg">Removed because they are no longer available: {removed.join(", ")}.</p>}
        <p className="font-display text-2xl">Your cart is empty.</p>
        <Link href="/menu" className="inline-block rounded-full bg-berry px-6 py-3 font-semibold text-cream">Browse the menu</Link>
      </div>
    );
  }

  const today = store.hours?.[istDayIndex(new Date())] ?? null;
  const wa = whatsappLink(store.whatsapp, "Hi Seiketsu! I would like to place an order.");

  return (
    <form onSubmit={submit} noValidate className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="space-y-8">
        {removed.length > 0 && (
          <p className="rounded-xl bg-butter/70 p-3 text-sm">Removed from your cart because they are no longer available: {removed.join(", ")}.</p>
        )}

        <section className="space-y-4">
          <h2 className="font-display text-2xl">Your details</h2>
          <Field id="name" label="Name" error={err("customer.name")}>
            <input id="name" autoComplete="name" required value={form.name} onChange={set("name")} className={input} {...aria("customer.name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="phone" label="Mobile number" error={err("customer.phone")} hint="We will send order updates here.">
              <input id="phone" type="tel" inputMode="tel" autoComplete="tel" required value={form.phone} onChange={set("phone")} placeholder="98765 43210" className={input} {...aria("customer.phone")} />
            </Field>
            <Field id="email" label="Email (optional)" error={err("customer.email")}>
              <input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} className={input} {...aria("customer.email")} />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-2xl">Pickup or delivery</h2>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Pickup or delivery">
            {(["pickup", "delivery"] as const).map((f) => {
              const enabled = f === "pickup" ? store.pickupEnabled : store.deliveryEnabled;
              return (
                <label
                  key={f}
                  className={`rounded-xl border p-4 ${!enabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${
                    fulfilment === f ? "border-berry bg-white ring-1 ring-berry" : "border-line"
                  }`}
                >
                  <input type="radio" name="fulfilment" value={f} disabled={!enabled} checked={fulfilment === f} onChange={() => setFulfilment(f)} className="sr-only" />
                  <span className="block font-semibold capitalize">{f}</span>
                  <span className="text-sm text-muted">
                    {!enabled ? "Not available right now" : f === "pickup" ? `Ready in about ${store.prepTimeMinutes} min` : store.pricing.deliveryFeePaise ? `${formatINR(store.pricing.deliveryFeePaise)} delivery` : "Free delivery"}
                  </span>
                </label>
              );
            })}
          </div>
          {fulfilment === "pickup" ? (
            <p className="text-sm text-muted">
              Collect from {store.addressLines.join(", ")}.{today ? ` Today ${formatHours(today)}.` : ""}
            </p>
          ) : (
            <div className="space-y-4">
              <Field id="line1" label="Delivery address" error={err("address.line1") ?? err("address")}>
                <input id="line1" autoComplete="street-address" value={form.line1} onChange={set("line1")} className={input} {...aria("address.line1")} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="landmark" label="Landmark (optional)">
                  <input id="landmark" value={form.landmark} onChange={set("landmark")} className={input} />
                </Field>
                <Field id="pincode" label="Pincode" error={err("address.pincode")}>
                  <input id="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.pincode} onChange={set("pincode")} className={input} {...aria("address.pincode")} />
                  {pinOutside && (
                    <p className="text-sm text-nonveg">
                      We don&apos;t deliver to {form.pincode} yet.{" "}
                      <Link href={`/coming-soon?pin=${form.pincode}`} className="font-semibold underline">Tell us you&apos;re there</Link>
                      {store.pickupEnabled && " or choose pickup above."}
                    </p>
                  )}
                </Field>
              </div>
              <Field id="instructions" label="Delivery instructions (optional)">
                <input id="instructions" value={form.instructions} onChange={set("instructions")} className={input} />
              </Field>
            </div>
          )}
        </section>

        <section className="space-y-2">
          <Field id="notes" label="Order notes (optional)" hint="Allergies or anything the kitchen should know.">
            <textarea id="notes" rows={3} value={form.notes} onChange={set("notes")} className={input} />
          </Field>
        </section>

        <fieldset className="space-y-2 text-sm">
          <legend className="mb-1 font-medium">Offers & new dishes (optional)</legend>
          {!customer?.marketingWhatsapp && (
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={marketing.whatsapp} onChange={(e) => setMarketing((m) => ({ ...m, whatsapp: e.target.checked }))} className="mt-0.5 size-4 accent-berry" />
              <span>Send me offers on WhatsApp</span>
            </label>
          )}
          {!customer?.marketingEmail && (
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={marketing.email} disabled={!form.email} onChange={(e) => setMarketing((m) => ({ ...m, email: e.target.checked }))} className="mt-0.5 size-4 accent-berry" />
              <span className={form.email ? "" : "text-muted"}>Send me offers by email{form.email ? "" : " (add your email above)"}</span>
            </label>
          )}
          <p className="text-xs text-muted">Order updates come on WhatsApp or SMS either way. Unsubscribe any time.</p>
        </fieldset>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-line bg-white/70 p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-2xl">Order summary</h2>
        <ul className="divide-y divide-line text-sm">
          {lines.map((l) => (
            <li key={l.key} className="flex gap-2 py-2.5">
              <div className="pt-0.5"><DietMark diet={l.diet} size={12} /></div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{l.quantity} × {l.name}</p>
                {l.variantLabel && <p className="text-muted">{l.variantLabel}</p>}
                {l.addOns.length > 0 && <p className="text-muted">+ {l.addOns.map((a) => a.name).join(", ")}</p>}
              </div>
              <span className="tabular">{formatINR(unitTotal(l) * l.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="space-y-3 rounded-2xl border border-line bg-white p-4">
          {coupon && rewards?.couponCode ? (
            <p className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-semibold">{rewards.couponCode}</span> applied · you save {formatINR(couponPaise)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCoupon("");
                  setCouponInput("");
                }}
                className="text-muted underline hover:text-ink"
              >
                Remove
              </button>
            </p>
          ) : (
            <div>
              <label htmlFor="coupon" className="block text-sm font-medium">Coupon code</label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="coupon"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setCoupon(couponInput.trim());
                    }
                  }}
                  autoComplete="off"
                  maxLength={20}
                  className={`${input} uppercase`}
                  aria-describedby={coupon && rewards?.couponError ? "coupon-error" : undefined}
                />
                <button type="button" onClick={() => setCoupon(couponInput.trim())} disabled={!couponInput.trim()} className="shrink-0 rounded-xl border border-berry px-4 text-sm font-semibold text-berry hover:bg-berry/5 disabled:opacity-40">
                  Apply
                </button>
              </div>
              {coupon && rewards?.couponError && <p id="coupon-error" role="alert" className="mt-1.5 text-sm text-nonveg">{rewards.couponError}</p>}
            </div>
          )}
          {rewards?.loyalty &&
            (rewards.loyalty.points > 0 ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-berry)]" />
                <span>
                  Use {rewards.loyalty.points} of your {rewards.loyalty.balance} points <span className="font-semibold text-veg">(−{formatINR(rewards.loyalty.valuePaise)})</span>
                </span>
              </label>
            ) : (
              <p className="text-sm text-muted">You have {rewards.loyalty.balance} points. You’ll earn more with this order.</p>
            ))}
        </div>
        {quote && (
          <dl className="tabular space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(quote.subtotalPaise)}</dd></div>
            {couponPaise > 0 && (
              <div className="flex justify-between text-veg"><dt>Coupon {rewards?.couponCode}</dt><dd>−{formatINR(couponPaise)}</dd></div>
            )}
            {pointsPaise > 0 && (
              <div className="flex justify-between text-veg"><dt>{rewards?.loyalty?.points} points</dt><dd>−{formatINR(pointsPaise)}</dd></div>
            )}
            {quote.deliveryFeePaise > 0 && <div className="flex justify-between"><dt>Delivery</dt><dd>{formatINR(quote.deliveryFeePaise)}</dd></div>}
            {store.pricing.tax.enabled && (
              <div className="flex justify-between text-muted">
                <dt>GST {store.pricing.tax.rateBps / 100}%{store.pricing.tax.inclusive ? " (included)" : ""}</dt>
                <dd>{formatINR(quote.taxPaise)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatINR(quote.totalPaise)}</dd></div>
          </dl>
        )}
        {quote?.belowMinimum && <p className="text-sm text-nonveg">Minimum order is {formatINR(store.pricing.minOrderPaise)}.</p>}
        {formError && <p role="alert" className="rounded-lg bg-nonveg/10 p-3 text-sm text-nonveg">{formError}</p>}
        {canOrder ? (
          <button
            type="submit"
            disabled={busy || !!quote?.belowMinimum}
            className="w-full rounded-full bg-berry py-3.5 font-semibold text-cream hover:bg-berry-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Starting payment…" : `Pay ${quote ? formatINR(quote.totalPaise) : ""}`}
          </button>
        ) : (
          <div className="space-y-2 rounded-xl bg-butter/60 p-3 text-sm">
            <p>{store.paymentsMode === "disabled" ? "Online payment is not set up yet." : "We are not taking online orders right now."}</p>
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="font-semibold text-berry underline">Order on WhatsApp instead</a>}
          </div>
        )}
        <p className="text-xs text-muted">Payments are processed securely by Razorpay. UPI, cards, net banking and wallets accepted.</p>
        <p className="text-xs text-muted">
          By paying you agree to our <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/refunds" className="underline">Refund policy</Link>.
        </p>
      </aside>
      {dialog}
    </form>
  );
}