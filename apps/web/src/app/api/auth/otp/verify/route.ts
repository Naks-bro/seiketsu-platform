import { z } from "zod";
import { NextResponse } from "next/server";
import { AuthError, verifyOtp } from "@/lib/server/customer-auth";
import { handleError, readJson } from "@/lib/server/http";
import { clientIp } from "@/lib/server/request";

const body = z.object({ challengeId: z.string().uuid(), code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });

export async function POST(req: Request) {
  try {
    const input = body.parse(await readJson(req));
    const c = await verifyOtp({ ...input, ip: await clientIp() });
    return NextResponse.json({ ok: true, needsName: !c.name });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleError(err);
  }
}