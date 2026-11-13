"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * New-order alerts for the admin and kitchen screens: a chime, a vibration on phones, and a system notification
 * (so it shows even when the tab is in the background or the screen is on another app).
 *
 * Sound is on by default and remembered per device. Browsers only allow audio after the first tap or key press on
 * the page, so the first interaction anywhere unlocks it and asks for notification permission.
 */
const KEY = "sk_order_sound";
const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

export type AlertPermission = NotificationPermission | "unsupported";

function chime(ctx: AudioContext) {
  // Two rising runs, loud enough to hear over a busy counter.
  [880, 1175, 1568, 880, 1175, 1568].forEach((f, i) => {
    const at = ctx.currentTime + i * 0.16 + (i >= 3 ? 0.25 : 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.35, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start(at);
    o.stop(at + 0.35);
  });
}

const supported = () => typeof window !== "undefined" && "Notification" in window;

// The sound choice and notification permission live outside React; components read them as an external store.
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const changed = () => listeners.forEach((l) => l());
const readSound = () => {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
};
const readPermission = (): AlertPermission => (supported() ? Notification.permission : "unsupported");

export function useOrderAlerts() {
  const sound = useSyncExternalStore(subscribe, readSound, () => true);
  const permission = useSyncExternalStore(subscribe, readPermission, (): AlertPermission => "default");
  const [unlocked, setUnlocked] = useState(false);
  const ctx = useRef<AudioContext | null>(null);

  const askPermission = useCallback(async () => {
    if (!supported()) return;
    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        /* very old browsers */
      }
    }
    changed();
  }, []);

  const unlock = useCallback(() => {
    try {
      ctx.current ??= new AudioContext();
      void ctx.current.resume();
      setUnlocked(true);
    } catch {
      /* no Web Audio */
    }
    void askPermission();
  }, [askPermission]);

  useEffect(() => {
    // Phones (Android Chrome) only show notifications through a service worker.
    navigator.serviceWorker?.register("/sw.js").catch(() => {});

    const first = () => {
      unlock();
      for (const e of UNLOCK_EVENTS) window.removeEventListener(e, first, true);
    };
    for (const e of UNLOCK_EVENTS) window.addEventListener(e, first, true);
    return () => {
      for (const e of UNLOCK_EVENTS) window.removeEventListener(e, first, true);
    };
  }, [unlock]);

  const toggle = useCallback(() => {
    unlock();
    const next = !sound;
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
    changed();
    if (next && ctx.current) chime(ctx.current);
  }, [sound, unlock]);

  /** Chime, vibrate and notify about new orders. */
  const alert = useCallback(
    async (title: string, body: string) => {
      if (sound) {
        if (ctx.current) chime(ctx.current);
        navigator.vibrate?.([300, 120, 300, 120, 300]);
      }
      if (!supported() || Notification.permission !== "granted") return;
      const options: NotificationOptions & { renotify?: boolean } = {
        body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "seiketsu-new-order",
        renotify: true,
        requireInteraction: true,
      };
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) await reg.showNotification(title, options);
        else new Notification(title, options);
      } catch {
        /* blocked by the device */
      }
    },
    [sound],
  );

  return { sound, unlocked, permission, toggle, askPermission, alert };
}
