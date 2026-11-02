import { z } from "zod";
import { NextResponse } from "next/server";
import { indianMobile } from "@seiketsu/core/checkout-schema";
import { AuthError, requestOtp } from "@/lib/server/customer-auth";
import { handleError, readJson } from "@/lib/server/http";
import { clientIp } from "@/lib/server/request";

const body = z.object({ phone: indianMobile, channel: z.enum(["whatsapp", "sms"]).optional() });

export async function POST(req: Request) {
  try {
    const input = body.parse(await readJson(req));
    return NextResponse.json(await requestOtp({ ...input, ip: await clientIp() }));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleError(err);
  }
}