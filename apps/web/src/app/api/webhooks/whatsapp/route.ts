import { getDb, webhookEvents } from "@seiketsu/db";
import { verifyMetaSignature, webhookChallenge, whatsappEventId, whatsappEventLabel } from "@seiketsu/core/whatsapp-webhook";
import { env } from "@/lib/server/env";
import { applyDeliveryReport } from "@/lib/server/messaging/send";
import { handleInbound } from "@/lib/server/whatsapp-inbox";

/** Meta calls this once when the callback URL is saved, to check the verify token. */
export function GET(req: Request) {
  const challenge = webhookChallenge(new URL(req.url).searchParams, env.whatsapp.verifyToken);
  return challenge ? new Response(challenge, { status: 200 }) : new Response("forbidden", { status: 403 });
}

/** Message and delivery-status events. Signed with the app secret; each delivery is stored once. */
export async function POST(req: Request) {
  const secret = env.whatsapp.appSecret;
  if (!secret) return new Response("webhook not configured", { status: 503 });
  // The signature covers the exact raw bytes, so read text, never re-serialised JSON.
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), secret)) return new Response("unauthorized", { status: 401 });

  let body: Parameters<typeof whatsappEventLabel>[0];
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const db = await getDb();
  const inserted = await db
    .insert(webhookEvents)
    .values({ id: whatsappEventId(raw), event: whatsappEventLabel(body), payload: body, processedAt: new Date() })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  // Auto-replies once per delivery (Meta retries are ignored). A failed reply must not make Meta resend.
  if (inserted.length) await handleInbound(body).catch((err) => console.error("[whatsapp] auto-reply failed:", err));
  type Status = { id?: string; status?: string; errors?: { title?: string; message?: string }[] };
  for (const entry of (body as { entry?: { changes?: { value?: { statuses?: Status[] } }[] }[] }).entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        if (s.id && s.status) await applyDeliveryReport(s.id, s.status, s.errors?.[0]?.message ?? s.errors?.[0]?.title ?? null);
      }
    }
  }
  return new Response("ok", { status: 200 });
}
