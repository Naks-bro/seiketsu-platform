"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { CategoryDTO, Diet } from "./types";

export type CartLine = {
  key: string;
  menuItemId: string;
  variantId: string;
  addOnIds: string[];
  quantity: number;
  note?: string;
  // Display snapshot; the server re-prices everything at checkout.
  name: string;
  variantLabel: string | null;
  unitPricePaise: number;
  addOns: { id: string; name: string; pricePaise: number }[];
  diet: Diet | null;
};

const STORAGE_KEY = "seiketsu.cart.v1";
const SOURCE_KEY = "seiketsu.source";

type CartCtx = {
  lines: CartLine[];
  ready: boolean;
  count: number;
  subtotalPaise: number;
  add: (line: Omit<CartLine, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  reconcile: (menu: CategoryDTO[]) => void;
  /** Names removed by the last reconcile because they left the menu. */
  removedNames: string[];
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
};

const Ctx = createContext<CartCtx | null>(null);

const lineKey = (l: Pick<CartLine, "variantId" | "addOnIds" | "note">) =>
  [l.variantId, [...l.addOnIds].sort().join("+"), l.note?.trim() ?? ""].join("|");

export const unitTotal = (l: Pick<CartLine, "unitPricePaise" | "addOns">) =>
  l.unitPricePaise + l.addOns.reduce((a, b) => a + b.pricePaise, 0);

function read(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(parsed) ? parsed.filter((l) => l && l.variantId && l.quantity > 0) : [];
  } catch {
    return [];
  }
}

// The cart lives in localStorage; React reads it as an external store so every
// tab and component sees the same lines without effects copying state around.
const EMPTY: CartLine[] = [];
const listeners = new Set<() => void>();
let snapshot: CartLine[] | null = null;

function getSnapshot(): CartLine[] {
  snapshot ??= read();
  return snapshot;
}

function setLines(update: (prev: CartLine[]) => CartLine[]) {
  snapshot = update(getSnapshot());
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {}
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    snapshot = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const noopSubscribe = () => () => {};

export function CartProvider({ children }: { children: React.ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [removedNames, setRemovedNames] = useState<string[]>([]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("src") === "qr") {
      try {
        sessionStorage.setItem(SOURCE_KEY, "qr");
      } catch {}
    }
  }, []);
  const add = useCallback((l: Omit<CartLine, "key">) => {
    const key = lineKey(l);
    setLines((prev) => {
      const existing = prev.find((p) => p.key === key);
      if (existing) {
        return prev.map((p) => (p.key === key ? { ...p, quantity: Math.min(20, p.quantity + l.quantity) } : p));
      }
      return [...prev, { ...l, key }];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0 ? prev.filter((p) => p.key !== key) : prev.map((p) => (p.key === key ? { ...p, quantity: Math.min(20, quantity) } : p)),
    );
  }, []);

  const remove = useCallback((key: string) => setLines((prev) => prev.filter((p) => p.key !== key)), []);
  const clear = useCallback(() => setLines(() => []), []);

  /** Drops items no longer on the menu and refreshes prices. Returns names that were removed. */
  const reconcile = useCallback((menu: CategoryDTO[]) => {
    const items = new Map(menu.flatMap((c) => c.items).map((i) => [i.id, i]));
    const removed: string[] = [];
    setLines((prev) => {
      const next: CartLine[] = [];
      for (const l of prev) {
        const item = items.get(l.menuItemId);
        const variant = item?.variants.find((v) => v.id === l.variantId);
        const allAddons = new Map(item?.addonGroups.flatMap((g) => g.addons).map((a) => [a.id, a]) ?? []);
        if (!item || !variant || !l.addOnIds.every((id) => allAddons.has(id))) {
          removed.push(l.name);
          continue;
        }
        next.push({
          ...l,
          name: item.name,
          unitPricePaise: variant.pricePaise,
          addOns: l.addOnIds.map((id) => {
            const a = allAddons.get(id)!;
            return { id: a.id, name: a.name, pricePaise: a.pricePaise };
          }),
        });
      }
      return next;
    });
    if (removed.length) setRemovedNames(removed);
  }, []);

  const value = useMemo<CartCtx>(
    () => ({
      lines,
      ready,
      count: lines.reduce((a, l) => a + l.quantity, 0),
      subtotalPaise: lines.reduce((a, l) => a + unitTotal(l) * l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
      reconcile,
      removedNames,
      drawerOpen,
      setDrawerOpen,
    }),
    [lines, ready, add, setQuantity, remove, clear, reconcile, removedNames, drawerOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}

export function orderSource(): "web" | "qr" {
  try {
    return sessionStorage.getItem(SOURCE_KEY) === "qr" ? "qr" : "web";
  } catch {
    return "web";
  }
}