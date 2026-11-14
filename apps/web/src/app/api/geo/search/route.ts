import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/server/geocode";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/request";

/** Address search for the location picker. Empty results (never an error page) when the geocoder is busy. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ results: [] });
  if (!(await rateLimit(`geo:search:${await clientIp()}`, 60, 60))) {
    return NextResponse.json({ results: [], error: "Too many searches. Please wait a moment." }, { status: 429 });
  }
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && url.searchParams.has("lat") ? { lat, lng } : null;
  try {
    const results = await searchPlaces(q, near);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (err) {
    console.warn("[geo] search failed:", (err as Error).message);
    return NextResponse.json({ results: [], error: "Search is unavailable. Move the pin on the map instead." });
  }
}
