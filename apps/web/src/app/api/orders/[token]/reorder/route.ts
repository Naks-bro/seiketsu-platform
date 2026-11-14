import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";
import { reorderByToken } from "@/lib/server/reorder";

/** "Order again": the past order's dishes as cart lines from today's menu. Nothing is placed or charged. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!(await rateLimit(`reorder:${await clientIp()}`, 30, 600))) {
    return NextResponse.json({ error: "Too many tries. Please wait a moment." }, { status: 429 });
  }
  const { token } = await params;
  const r = /^[A-Za-z0-9_-]{10,80}$/.test(token) ? await reorderByToken(token) : null;
  if (!r) return NextResponse.json({ error: "We couldn't find that order." }, { status: 404 });
  return NextResponse.json(r);
}
