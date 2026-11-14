import "server-only";

/**
 * Address search and pin-to-address, through Photon (komoot's free OpenStreetMap geocoder; no key, no billing).
 * Kept behind our own routes so results are cached, abuse is rate limited, and the provider can be swapped (for a
 * self-hosted Photon or Nominatim) without touching the screens. The map pin, not this text, decides delivery.
 */
const BASE = (process.env.GEOCODER_URL?.trim() || "https://photon.komoot.io").replace(/\/$/, "");
const UA = "Seiketsu/1.0 (+https://www.seiketsu.co.in)";
/** Search is limited to India and leans towards the café. */
const INDIA_BBOX = "68.1,6.5,97.4,35.7";

export type Place = { label: string; line: string; area: string; city: string; pincode: string; lat: number; lng: number };

type Feature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined>;
};

const cache = new Map<string, { at: number; places: Place[] }>();
const TTL_MS = 24 * 60 * 60_000;
const MAX_ENTRIES = 1000;

function remember(key: string, places: Place[]) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), places });
}

function toPlace(f: Feature, withName = true): Place | null {
  const [lng, lat] = f.geometry?.coordinates ?? [];
  const p = f.properties ?? {};
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  // A dropped pin lands on whatever shop is nearest; its name is not the customer's address.
  const name = withName && p.name && p.name !== p.street ? p.name : "";
  // Locality ("Seven Bungalows") reads better than the municipal ward ("K/W Ward") that Mumbai districts carry.
  const area = [p.locality, p.suburb, p.district].find((a) => a && !/ward$/i.test(a)) ?? "";
  const city = p.city || p.county || p.state || "";
  const line = [name, street].filter(Boolean).join(", ") || area || city;
  const label = [line, area !== line ? area : "", city].filter(Boolean).join(", ");
  return { label, line, area, city, pincode: /^[1-9]\d{5}$/.test(p.postcode ?? "") ? p.postcode! : "", lat: lat as number, lng: lng as number };
}

async function photon(path: string, params: Record<string, string>, withName = true): Promise<Place[]> {
  const key = path + "?" + new URLSearchParams(params).toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.places;
  const res = await fetch(`${BASE}${key}`, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const json = (await res.json()) as { features?: Feature[] };
  const seen = new Set<string>();
  const places = (json.features ?? [])
    .map((f) => toPlace(f, withName))
    .filter((p): p is Place => !!p)
    .filter((p) => (seen.has(p.label) ? false : (seen.add(p.label), true)));
  remember(key, places);
  return places;
}

export function searchPlaces(q: string, near: { lat: number; lng: number } | null): Promise<Place[]> {
  const params: Record<string, string> = { q: q.trim().slice(0, 120), limit: "6", lang: "en", bbox: INDIA_BBOX };
  if (near) Object.assign(params, { lat: near.lat.toFixed(4), lon: near.lng.toFixed(4) });
  return photon("/api/", params);
}

export async function reversePlace(lat: number, lng: number): Promise<Place | null> {
  // ~11 m of rounding lets nearby taps share a cached answer.
  const [p] = await photon("/reverse", { lat: lat.toFixed(4), lon: lng.toFixed(4), lang: "en", limit: "1" }, false);
  return p ? { ...p, lat, lng } : null;
}
