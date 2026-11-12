import { NextResponse } from "next/server";
import { AuthError } from "@/lib/server/customer-auth";
import { handleError } from "@/lib/server/http";
import { clientIp } from "@/lib/server/request";
import { checkWhatsAppLogin } from "@/lib/server/whatsapp-login";

export async function POST() {
  try {
    return NextResponse.json(await checkWhatsAppLogin(await clientIp()));
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return handleError(err);
  }
}
