import "server-only";
import { env } from "./env";

/**
 * Pushes a small "something changed" signal to browsers through Supabase
 * Realtime broadcast. Payloads never contain customer details; clients
 * re-fetch through authenticated routes. Without Supabase configured this
 * is a no-op and pages fall back to polling.
 */
export async function publish(topic: string, event: string, payload: Record<string, unknown> = {}) {
  const { url, serviceRoleKey } = env.supabase;
  if (!url || !serviceRoleKey) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages: [{ topic, event, payload, private: false }] }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error("[realtime] publish failed", topic, err);
  }
}

export const topics = {
  order: (publicToken: string) => `order-${publicToken}`,
  outlet: (outletId: string) => `outlet-${outletId}`,
};