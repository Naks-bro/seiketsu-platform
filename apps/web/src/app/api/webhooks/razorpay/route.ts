import { handleRazorpayWebhook } from "@/lib/server/webhook";

export async function POST(req: Request) {
  // The signature covers the exact raw bytes, so read text, never re-serialised JSON.
  const raw = await req.text();
  const r = await handleRazorpayWebhook(raw, req.headers.get("x-razorpay-signature"), req.headers.get("x-razorpay-event-id"));
  return new Response(r.body, { status: r.status });
}