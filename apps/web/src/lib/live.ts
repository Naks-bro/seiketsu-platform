"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const realtimeEnabled = Boolean(url && anonKey);

let client: Promise<SupabaseClient> | null = null;
function supabase() {
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!, anonKey!, { auth: { persistSession: false } }),
  );
  return client;
}

/**
 * Calls onChange when the server signals a change on `topic`, and also on a
 * timer as a safety net (every 5s without Supabase, every 30s with it).
 */
export function useLive(topic: string | null, onChange: () => void) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    if (!topic) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    if (realtimeEnabled) {
      supabase().then((sb) => {
        if (cancelled) return;
        channel = sb.channel(topic).on("broadcast", { event: "*" }, () => cb.current()).subscribe();
      });
    }
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") cb.current();
    }, realtimeEnabled ? 30_000 : 5_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (channel) supabase().then((sb) => sb.removeChannel(channel!));
    };
  }, [topic]);
}