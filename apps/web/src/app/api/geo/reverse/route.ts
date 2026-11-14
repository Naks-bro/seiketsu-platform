import { NextResponse } from "next/server";
import { reversePlace } from "@/lib/server/geocode";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

/** The street and area under a map pin, to prefill the address form. The pin itself is what counts. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Invalid location" }, { status: 400 });
  }
  if (!(await rateLimit(`geo:reverse:${await clientIp()}`, 60, 60))) {
    return NextResponse.json({ result: null, error: "Too many requests. Please wait a moment." }, { status: 429 });
  }
  try {
    return NextResponse.json({ result: await reversePlace(lat, lng) }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (err) {
    console.warn("[geo] reverse failed:", (err as Error).message);
    return NextResponse.json({ result: null });
  }
}
