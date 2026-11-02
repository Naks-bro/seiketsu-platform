import { z } from "zod";
import { NextResponse } from "next/server";
import { indianMobile } from "@seiketsu/core/checkout-schema";
import { AuthError, isTestPhone, markWidgetOtp, startWidgetOtp, verifyTestLogin, verifyWidgetLogin } from "@/lib/server/customer-auth";
import { env } from "@/lib/server/env";
import { handleError, readJson } from "@/lib/server/http";
import { clientIp } from "@/lib/server/request";

/**
 * MSG91 OTP widget login.
 *  { action: "start", phone }               → limits checked before the widget sends a code
 *  { action: "sent", phone, ok, error? }    → widget result, so spend counts only real sends
 *  { action: "verify", phone, accessToken } → token confirmed with MSG91, then signed in
 *  { action: "verify-test", phone, code }   → temporary TEST_LOGINS numbers (no SMS)
 */
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), phone: indianMobile }),
  z.object({ action: z.literal("sent"), phone: indianMobile, ok: z.boolean(), error: z.string().max(300).optional() }),
  z.object({ action: z.literal("verify-test"), phone: indianMobile, code: z.string().trim().regex(/^\d{4,8}$/, "Enter the code") }),
  z.object({ action: z.literal("verify"), phone: indianMobile, accessToken: z.string().min(10).max(4000) }),
]);

export async function POST(req: Request) {
  if (!env.messaging.otpWidget) return NextResponse.json({ error: "Phone login is not set up yet." }, { status: 503 });
  try {
    const input = body.parse(await readJson(req));
    const ip = await clientIp();
    if (input.action === "start") {
      if (isTestPhone(input.phone)) return NextResponse.json({ ok: true, test: true });
      await startWidgetOtp({ phone: input.phone, ip });
      return NextResponse.json({ ok: true });
    }
    if (input.action === "sent") {
      await markWidgetOtp(input.phone, input.ok, input.error);
      return NextResponse.json({ ok: true });
    }
    if (input.action === "verify-test") {
      const c = await verifyTestLogin({ phone: input.phone, code: input.code, ip });
      return NextResponse.json({ ok: true, needsName: !c.name });
    }
    const c = await verifyWidgetLogin({ phone: input.phone, accessToken: input.accessToken, ip });
    return NextResponse.json({ ok: true, needsName: !c.name });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleError(err);
  }
}