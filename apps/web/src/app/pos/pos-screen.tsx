"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { computeQuote, type PricingSettings } from "@seiketsu/core/pricing";
import type { CategoryDTO, MenuItemDTO } from "@/lib/types";
import { formatINR, fromPrice } from "@/lib/format";
import { DietMark } from "@/components/diet-mark";
import { posSaleAction, type PosResult } from "./actions";

type Line = {
  key: string;
  menuItemId: string;
  variantId: string;
  addOnIds: string[];
  name: string;
  detail: string;
  unitPaise: number;
  quantity: number;
  note: string;
};
type Pay = "cash" | "upi" | "card";

const chip = "min-h-11 rounded-full border px-4 text-sm font-medium";

export function PosScreen({ menu, pricing, staffName }: { menu: CategoryDTO[]; pricing: PricingSettings; staffName: string }) {
  const [cat, setCat] = useState(menu[0]?.slug ?? "");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [picking, setPicking] = useState<MenuItemDTO | null>(null);
  const [customer, setCustomer] = useState({ name: "", phone: "", table: "", notes: "" });
  const [pay, setPay] = useState<Pay>("cash");
  const [tendered, setTendered] = useState("");
  const [result, setResult] = useState<PosResult | null>(null);
  const [pending, start] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return menu.flatMap((c) => c.items).filter((i) => i.name.toLowerCase().includes(q));
    return menu.find((c) => c.slug === cat)?.items ?? [];
  }, [menu, cat, query]);

  const quote = useMemo(
    () =>
      lines.length
        ? computeQuote(lines.map((l) => ({ unitPricePaise: l.unitPaise, addOnPricesPaise: [], quantity: l.quantity })), pricing, "pickup")
        : null,
    [lines, pricing],
  );
  const total = quote?.totalPaise ?? 0;
  const tenderedPaise = tendered ? Math.round(Number(tendered) * 100) : null;
  const change = pay === "cash" && tenderedPaise !== null ? tenderedPaise - total : null;

  function addLine(item: MenuItemDTO, variantId: string, addOnIds: string[], quantity = 1, note = "") {
    const v = item.variants.find((x) => x.id === variantId)!;
    const extras = item.addonGroups.flatMap((g) => g.addons).filter((a) => addOnIds.includes(a.id));
    const key = [variantId, ...[...addOnIds].sort(), note].join("|");
    const detail = [v.label, v.portion, ...extras.map((e) => `+ ${e.name}`)].filter(Boolean).join(" · ");
    const unitPaise = v.pricePaise + extras.reduce((s, e) => s + e.pricePaise, 0);
    setLines((ls) => {
      const found = ls.find((l) => l.key === key);
      if (found) return ls.map((l) => (l.key === key ? { ...l, quantity: Math.min(20, l.quantity + quantity) } : l));
      return [...ls, { key, menuItemId: item.id, variantId, addOnIds, name: item.name, detail, unitPaise, quantity, note }];
    });
  }

  function tap(item: MenuItemDTO) {
    const simple = item.variants.length === 1 && item.addonGroups.every((g) => g.addons.length === 0);
    if (simple) addLine(item, item.variants[0].id, []);
    else setPicking(item);
  }

  const qty = (key: string, d: number) =>
    setLines((ls) => ls.flatMap((l) => (l.key !== key ? [l] : l.quantity + d <= 0 ? [] : [{ ...l, quantity: Math.min(20, l.quantity + d) }])));

  function reset() {
    setLines([]);
    setCustomer({ name: "", phone: "", table: "", notes: "" });
    setTendered("");
    setPay("cash");
    setResult(null);
    searchRef.current?.focus();
  }

  function charge() {
    start(async () => {
      const r = await posSaleAction({
        lines: lines.map((l) => ({ menuItemId: l.menuItemId, variantId: l.variantId, addOnIds: l.addOnIds, quantity: l.quantity, note: l.note || undefined })),
        customerName: customer.name || undefined,
        phone: customer.phone || undefined,
        tableLabel: customer.table || undefined,
        notes: customer.notes || undefined,
        payment: pay,
        tenderedPaise: pay === "cash" && tenderedPaise !== null ? tenderedPaise : undefined,
      });
      setResult(r);
    });
  }

  if (result?.ok) {
    return (
      <div className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center">
        <div className="w-full space-y-4 rounded-2xl border border-line bg-white p-8" role="status">
          <p className="text-sm font-semibold text-veg">Paid and sent to the kitchen</p>
          <p className="font-display text-5xl text-berry">{result.orderNumber}</p>
          <p className="tabular-nums text-lg">Total {formatINR(result.totalPaise)}</p>
          {result.changePaise !== null && (
            <p className="rounded-xl bg-butter px-4 py-3 text-2xl font-semibold tabular-nums">Give change: {formatINR(result.changePaise)}</p>
          )}
          <div className="flex flex-col gap-2 pt-2">
            <a href={`/pos/receipt/${result.id}?print=1`} target="_blank" rel="noreferrer" className="min-h-12 rounded-full border border-line py-3 font-semibold hover:bg-paper">
              Print receipt
            </a>
            <button type="button" onClick={reset} autoFocus className="min-h-12 rounded-full bg-berry py-3 font-semibold text-cream hover:bg-berry-deep">
              New order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_400px]">
      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-cream px-4 py-3">
          <h1 className="font-display text-2xl text-berry">Counter</h1>
          <span className="text-sm text-muted">{staffName}</span>
          <nav className="ml-auto flex gap-1 text-sm" aria-label="Staff">
            <Link href="/kitchen" className="rounded-lg px-3 py-2 hover:bg-paper">Kitchen</Link>
            <Link href="/admin/orders" className="rounded-lg px-3 py-2 hover:bg-paper">Orders</Link>
          </nav>
        </header>
        <div className="space-y-3 border-b border-line px-4 py-3">
          <label className="sr-only" htmlFor="pos-search">Search dishes</label>
          <input
            id="pos-search"
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dishes"
            className="w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus-visible:border-berry"
          />
          {!query && (
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Categories">
              {menu.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  role="tab"
                  aria-selected={cat === c.slug}
                  onClick={() => setCat(c.slug)}
                  className={`${chip} whitespace-nowrap ${cat === c.slug ? "border-berry bg-berry text-cream" : "border-line bg-white hover:border-berry"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <ul className="clear-badge grid flex-1 content-start gap-3 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => tap(item)}
                className="flex h-full min-h-24 w-full flex-col justify-between rounded-xl border border-line bg-white p-3 text-left hover:border-berry focus-visible:border-berry"
              >
                <span className="flex items-start gap-2 font-medium leading-snug">
                  <DietMark diet={item.diet} size={12} />
                  {item.name}
                </span>
                <span className="mt-2 text-sm tabular-nums text-muted">
                  {new Set(item.variants.map((v) => v.pricePaise)).size > 1 && "from "}
                  {formatINR(fromPrice(item.variants.map((v) => v.pricePaise)))}
                </span>
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="text-muted">No dishes match “{query}”.</li>}
        </ul>
      </div>

      <aside className="flex flex-col border-l border-line bg-white lg:sticky lg:top-0 lg:h-dvh" aria-label="Current order">
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="mb-3 font-display text-xl">Order</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted">Tap dishes to add them.</p>
          ) : (
            <ul className="divide-y divide-line">
              {lines.map((l) => (
                <li key={l.key} className="flex items-start gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug">{l.name}</p>
                    {l.detail && <p className="text-xs text-muted">{l.detail}</p>}
                    {l.note && <p className="text-xs">Note: {l.note}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => qty(l.key, -1)} className="size-10 rounded-full border border-line text-lg" aria-label={`One less ${l.name}`}>−</button>
                    <span className="w-6 text-center tabular-nums" aria-live="polite">{l.quantity}</span>
                    <button type="button" onClick={() => qty(l.key, 1)} className="size-10 rounded-full border border-line text-lg" aria-label={`One more ${l.name}`}>+</button>
                  </div>
                  <p className="w-20 text-right tabular-nums">{formatINR(l.unitPaise * l.quantity)}</p>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <label className="space-y-1">Name<input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Walk-in" className="w-full rounded-lg border border-line px-3 py-2" /></label>
            <label className="space-y-1">Table / token<input value={customer.table} onChange={(e) => setCustomer({ ...customer, table: e.target.value })} maxLength={20} className="w-full rounded-lg border border-line px-3 py-2" /></label>
            <label className="col-span-2 space-y-1">Mobile <span className="text-muted">(optional, sends the bill on WhatsApp)</span><input inputMode="numeric" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2" /></label>
            <label className="col-span-2 space-y-1">Kitchen note<input value={customer.notes} onChange={(e) => setCustomer({ ...customer, notes: e.target.value })} maxLength={300} className="w-full rounded-lg border border-line px-3 py-2" /></label>
          </div>
        </div>

        <div className="clear-badge space-y-3 border-t border-line p-4">
          {quote && (
            <dl className="space-y-1 text-sm tabular-nums">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(quote.subtotalPaise)}</dd></div>
              {quote.taxPaise > 0 && <div className="flex justify-between text-muted"><dt>GST{pricing.tax.inclusive ? " (included)" : ""}</dt><dd>{formatINR(quote.taxPaise)}</dd></div>}
              <div className="flex justify-between text-lg font-semibold"><dt>Total</dt><dd>{formatINR(total)}</dd></div>
            </dl>
          )}
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Payment</legend>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "upi", "card"] as const).map((p) => (
                <label key={p} className={`${chip} grid cursor-pointer place-items-center ${pay === p ? "border-berry bg-berry text-cream" : "border-line hover:border-berry"}`}>
                  <input type="radio" name="pay" value={p} checked={pay === p} onChange={() => setPay(p)} className="sr-only" />
                  {p === "cash" ? "Cash" : p === "upi" ? "UPI" : "Card"}
                </label>
              ))}
            </div>
          </fieldset>
          {pay === "cash" && total > 0 && (
            <div className="space-y-2">
              <label className="block text-sm">
                Cash received (₹)
                <input inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ""))} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-lg tabular-nums" />
              </label>
              <div className="flex flex-wrap gap-2">
                {[...new Set([total / 100, Math.ceil(total / 10000) * 100, 500, 2000].filter((v) => v * 100 >= total))].slice(0, 4).map((v) => (
                  <button key={v} type="button" onClick={() => setTendered(String(v))} className="min-h-10 rounded-full border border-line px-3 text-sm tabular-nums hover:bg-paper">₹{v}</button>
                ))}
              </div>
              {change !== null && (
                <p className={`text-sm font-semibold tabular-nums ${change < 0 ? "text-nonveg" : "text-veg"}`}>{change < 0 ? `Short by ${formatINR(-change)}` : `Change: ${formatINR(change)}`}</p>
              )}
            </div>
          )}
          {result && !result.ok && <p role="alert" className="rounded-lg bg-nonveg/10 p-2 text-sm text-nonveg">{result.error}</p>}
          <button
            type="button"
            onClick={charge}
            disabled={pending || lines.length === 0 || (change !== null && change < 0)}
            className="min-h-14 w-full rounded-full bg-berry text-lg font-semibold text-cream hover:bg-berry-deep disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : lines.length ? `Charge ${formatINR(total)} · ${pay === "cash" ? "Cash" : pay.toUpperCase()}` : "Charge"}
          </button>
          {lines.length > 0 && <button type="button" onClick={() => setLines([])} className="w-full text-sm text-muted hover:text-nonveg">Clear order</button>}
        </div>
      </aside>

      {picking && <PickDialog item={picking} onClose={() => setPicking(null)} onAdd={(v, a, q, n) => { addLine(picking, v, a, q, n); setPicking(null); }} />}
    </div>
  );
}

function PickDialog({ item, onClose, onAdd }: { item: MenuItemDTO; onClose: () => void; onAdd: (variantId: string, addOnIds: string[], qty: number, note: string) => void }) {
  const [variantId, setVariantId] = useState(item.variants[0].id);
  const [extras, setExtras] = useState<string[]>([]);
  const [q, setQ] = useState(1);
  const [note, setNote] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const open = (el: HTMLDialogElement | null) => {
    ref.current = el;
    if (el && !el.open) el.showModal();
  };
  const v = item.variants.find((x) => x.id === variantId)!;
  const unit = v.pricePaise + item.addonGroups.flatMap((g) => g.addons).filter((a) => extras.includes(a.id)).reduce((s, a) => s + a.pricePaise, 0);

  return (
    <dialog ref={open} onClose={onClose} aria-labelledby="pick-title" className="m-auto w-[min(560px,94vw)] rounded-2xl p-0 backdrop:bg-black/40">
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); onAdd(variantId, extras, q, note.trim()); }} className="space-y-4 p-5">
        <h2 id="pick-title" className="font-display text-2xl text-berry">{item.name}</h2>
        {item.variants.length > 1 && (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Size</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {item.variants.map((x) => (
                <label key={x.id} className={`flex min-h-12 cursor-pointer items-center justify-between rounded-xl border px-3 ${variantId === x.id ? "border-berry bg-berry/5" : "border-line"}`}>
                  <span><input type="radio" name="v" checked={variantId === x.id} onChange={() => setVariantId(x.id)} className="mr-2 accent-[var(--color-berry)]" />{[x.label, x.portion].filter(Boolean).join(" · ") || "Regular"}</span>
                  <span className="tabular-nums">{formatINR(x.pricePaise)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {item.addonGroups.map((g) => (
          <fieldset key={g.id}>
            <legend className="mb-2 text-sm font-medium">{g.name}</legend>
            <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
              {g.addons.map((a) => (
                <label key={a.id} className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl border border-line px-3 text-sm">
                  <span>
                    <input type="checkbox" checked={extras.includes(a.id)} onChange={(e) => setExtras((xs) => (e.target.checked ? [...xs, a.id] : xs.filter((id) => id !== a.id)))} className="mr-2 accent-[var(--color-berry)]" />
                    {a.name}
                  </span>
                  <span className="tabular-nums text-muted">+{formatINR(a.pricePaise)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="block text-sm">Note for the kitchen<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} className="mt-1 w-full rounded-lg border border-line px-3 py-2" /></label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setQ((n) => Math.max(1, n - 1))} className="size-11 rounded-full border border-line text-lg" aria-label="Fewer">−</button>
            <span className="w-8 text-center tabular-nums" aria-live="polite">{q}</span>
            <button type="button" onClick={() => setQ((n) => Math.min(20, n + 1))} className="size-11 rounded-full border border-line text-lg" aria-label="More">+</button>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="ml-auto min-h-11 rounded-full border border-line px-4">Cancel</button>
          <button type="submit" className="min-h-11 rounded-full bg-berry px-5 font-semibold text-cream">Add {formatINR(unit * q)}</button>
        </div>
      </form>
    </dialog>
  );
}