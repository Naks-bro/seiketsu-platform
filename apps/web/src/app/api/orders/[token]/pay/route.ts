import { NextResponse } from "next/server";
import { resumePayment } from "@/lib/server/orders";
import { handleError } from "@/lib/server/http";

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    return NextResponse.json(await resumePayment(token));
  } catch (err) {
    return handleError(err);
  }
}