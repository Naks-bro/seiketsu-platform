"use client";

import { useSyncExternalStore } from "react";
import { isPincode } from "@seiketsu/core/delivery-area";
import { isLatLng, type LatLng } from "@seiketsu/core/delivery-zones";

/**
 * Where the customer wants their food: delivery to a pincode, or pickup.
 * Kept in localStorage (a convenience, never trusted: checkout re-checks the
 * pincode on the server). The sheet that asks for it is opened through
 * requestLocation(), which resolves once the customer has chosen.
 */
export type Location = { mode: "delivery"; pincode: string; point?: LatLng; area?: string } | { mode: "pickup"; pincode: null };

const KEY = "seiketsu.location.v1";
const listeners = new Set<() => void>();

type State = { location: Location | null; sheetOpen: boolean };
let state: State | null = null;
let pending: ((ok: boolean) => void)[] = [];

function read(): Location | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v?.mode === "pickup") return { mode: "pickup", pincode: null };
    if (v?.mode === "delivery") {
      const point = isLatLng(v.point) ? { lat: v.point.lat, lng: v.point.lng } : undefined;
      const pincode = typeof v.pincode === "string" && isPincode(v.pincode) ? v.pincode : "";
      // A map pin (with delivery zones) or a pincode (without them) is enough.
      if (point || pincode) return { mode: "delivery", pincode, ...(point ? { point } : {}), ...(typeof v.area === "string" && v.area ? { area: v.area.slice(0, 80) } : {}) };
    }
  } catch {}
  return null;
}

function get(): State {
  state ??= { location: read(), sheetOpen: false };
  return state;
}

function emit(next: State) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) emit({ ...get(), location: read() });
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

const SERVER: State = { location: null, sheetOpen: false };

export function useLocation() {
  return useSyncExternalStore(subscribe, get, () => SERVER);
}

function settle(ok: boolean) {
  const waiting = pending;
  pending = [];
  for (const r of waiting) r(ok);
}

/** Saves the choice and closes the sheet; `ok` tells waiting callers whether to go on. */
export function setLocation(location: Location, ok = true) {
  try {
    localStorage.setItem(KEY, JSON.stringify(location));
  } catch {}
  emit({ location, sheetOpen: false });
  settle(ok);
}

export function openLocationSheet() {
  emit({ ...get(), sheetOpen: true });
}

export function closeLocationSheet() {
  emit({ ...get(), sheetOpen: false });
  settle(false);
}

/** Resolves true at once if a choice exists; otherwise asks first. */
export function requestLocation(): Promise<boolean> {
  if (get().location) return Promise.resolve(true);
  return new Promise((resolve) => {
    pending.push(resolve);
    openLocationSheet();
  });
}
