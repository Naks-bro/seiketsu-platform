import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/server/env";
import { applyDeliveryReport } from "@/lib/server/messaging/send";

/**
 * MSG91 delivery reports (SMS and WhatsApp). MSG91 does not sign webhooks, so
 * the URL carries a secret: /api/webhooks/msg91?token=<MSG91_WEBHOOK_TOKEN>.
 * Field names differ between products, so several spellings are accepted.
 */
const ID_KEYS = ["requestId", "request_id", "requestID", "uuid", "messageId", "message_id", "id"];
const STATUS_KEYS = ["status", "eventName", "event", "report_status", "deliveryStatus", "desc"];
const ERROR_KEYS = ["failureReason", "reason", "error", "description"];

const pick = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== "") return String(o[k]);
  return null;
};

function sameToken(a: string | null, b: string) {
  if (!a) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  const expected = env.messaging.msg91.webhookToken;
  if (!expected) return new Response("webhook not configured", { status: 503 });
  if (!sameToken(new URL(req.url).searchParams.get("token"), expected)) return new Response("unauthorized", { status: 401 });

  let body: unknown;
  const text = await req.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = Object.fromEntries(new URLSearchParams(text));
  }
  const raw = Array.isArray(body) ? body : (body as { data?: unknown })?.data ?? body;
  const entries = (Array.isArray(raw) ? raw : [raw]).filter((e): e is Record<string, unknown> => !!e && typeof e === "object");

  let updated = 0;
  for (const e of entries) {
    const id = pick(e, ID_KEYS);
    const status = pick(e, STATUS_KEYS);
    if (id && status) updated += await applyDeliveryReport(id, status, pick(e, ERROR_KEYS));
  }
  return Response.json({ received: entries.length, updated });
}