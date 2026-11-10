/** Server-only. WhatsApp Cloud API (Meta) webhook checks. */
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Meta's subscribe check: GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
 * Returns the challenge to echo back when the token matches, otherwise null.
 */
export function webhookChallenge(params: URLSearchParams, verifyToken: string | undefined): string | null {
  if (!verifyToken) return null;
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (params.get("hub.mode") !== "subscribe" || !token || !challenge) return null;
  return safeEqual(token, verifyToken) ? challenge : null;
}

/** X-Hub-Signature-256: "sha256=" + HMAC-SHA256(raw body, app secret), hex. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(`sha256=${expected}`, header);
}

/** Meta can resend a delivery; the body's hash is a stable id for de-duplication. */
export const whatsappEventId = (rawBody: string) => `wa:${createHash("sha256").update(rawBody).digest("hex")}`;

type Change = { field?: string; value?: { messages?: unknown[]; statuses?: unknown[] } };
type Payload = { object?: string; entry?: { changes?: Change[] }[] };

/** A short label for the log, e.g. "whatsapp:messages:status". */
export function whatsappEventLabel(body: Payload): string {
  const change = body.entry?.[0]?.changes?.[0];
  const kind = change?.value?.statuses?.length ? "status" : change?.value?.messages?.length ? "message" : "other";
  return `whatsapp:${change?.field ?? "unknown"}:${kind}`;
}
