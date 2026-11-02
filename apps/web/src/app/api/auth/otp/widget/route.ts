import { z } from "zod";
import { NextResponse } from "next/server";
import { indianMobile } from "@seiketsu/core/checkout-schema";
import { AuthError, startWidgetOtp, verifyWidgetLogin } from "@/lib/server/customer-auth";
import { env } from "@/lib/server/env";
import { handleError, readJson } from "@/lib/server/http";
import { clientIp } from "@/lib/server/request";

/**
 * MSG91 OTP widget login.
 *  { action: "start", phone }               → limits checked before the widget sends a code
 *  { action: "verify", phone, accessToken } → token confirmed with MSG91, then signed in
 */
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), phone: indianMobile }),
  z.object({ action: z.literal("verify"), phone: indianMobile, accessToken: z.string().min(10).max(4000) }),
]);

export async function POST(req: Request) {
  if (!env.messaging.otpWidget) return NextResponse.json({ error: "Phone login is not set up yet." }, { status: 503 });
  try {
    const input = body.parse(await readJson(req));
    const ip = await clientIp();
    if (input.action === "start") {
      await startWidgetOtp({ phone: input.phone, ip });
      return NextResponse.json({ ok: true });
    }
    const c = await verifyWidgetLogin({ phone: input.phone, accessToken: input.accessToken, ip });
    return NextResponse.json({ ok: true, needsName: !c.name });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleError(err);
  }
}