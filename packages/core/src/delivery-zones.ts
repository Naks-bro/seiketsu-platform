/**
 * Delivery zones: where an outlet delivers, decided from a map pin. The same rules run in the browser (to tell the
 * customer straight away), on the server (the authority when an order is placed) and in tests.
 *
 * A zone is a circle around the outlet or a drawn area. Coordinates are WGS84 degrees; polygons are GeoJSON-style
 * rings of [lng, lat].
 */
import { isServiceable } from "./delivery-area";

export type LatLng = { lat: number; lng: number };
export type Ring = [number, number][];

export type DeliveryZone = {
  id: string;
  name: string;
  kind: "radius" | "polygon";
  /** Metres from the outlet, for kind "radius". */
  radiusM: number | null;
  /** [lng, lat] points, for kind "polygon". Open or closed; it is closed when checked. */
  polygon: Ring | null;
  feePaise: number;
  minOrderPaise: number;
  etaMinutes: number | null;
  active: boolean;
  sort: number;
};

const EARTH_M = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Most a zone may reach from the outlet. Further than this is almost always a mistake on the map. */
export const MAX_ZONE_REACH_M = 30_000;
export const MAX_POLYGON_POINTS = 200;

export const isLatLng = (p: Partial<LatLng> | null | undefined): p is LatLng =>
  !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat!) <= 90 && Math.abs(p.lng!) <= 180;

/** Great-circle distance in metres. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const closed = (ring: Ring): Ring => {
  if (ring.length === 0) return ring;
  const [f, l] = [ring[0], ring[ring.length - 1]];
  return f[0] === l[0] && f[1] === l[1] ? ring : [...ring, f];
};

/** Point in polygon by ray casting. Points on an edge count as inside. Fine at city scale. */
export function insidePolygon(p: LatLng, ring: Ring): boolean {
  const r = closed(ring);
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    // On the edge: collinear and within the segment's box.
    const cross = (p.lng - xi) * (yj - yi) - (p.lat - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-12 && p.lng >= Math.min(xi, xj) && p.lng <= Math.max(xi, xj) && p.lat >= Math.min(yi, yj) && p.lat <= Math.max(yi, yj)) return true;
    if (yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentsCross(a: [number, number], b: [number, number], c: [number, number], d: [number, number]) {
  const o = (p: [number, number], q: [number, number], r: [number, number]) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b) && o(a, b, c) !== 0 && o(a, b, d) !== 0;
}

/** Why a zone cannot be saved, or null when it is fine. */
export function zoneProblem(z: Pick<DeliveryZone, "kind" | "radiusM" | "polygon" | "name">, outlet: LatLng | null): string | null {
  if (!z.name.trim()) return "Give the zone a name.";
  if (!outlet) return "Set the café's location on the map first.";
  if (z.kind === "radius") {
    if (!z.radiusM || z.radiusM < 100) return "The radius must be at least 100 m.";
    if (z.radiusM > MAX_ZONE_REACH_M) return `The radius can be at most ${MAX_ZONE_REACH_M / 1000} km.`;
    return null;
  }
  const ring = z.polygon ?? [];
  const open = closed(ring).slice(0, -1);
  if (open.length < 3) return "Draw at least 3 points.";
  if (open.length > MAX_POLYGON_POINTS) return `Use at most ${MAX_POLYGON_POINTS} points.`;
  if (open.some(([lng, lat]) => !isLatLng({ lat, lng }))) return "A point is off the map.";
  if (open.some(([lng, lat]) => distanceMeters(outlet, { lat, lng }) > MAX_ZONE_REACH_M)) return `Keep the area within ${MAX_ZONE_REACH_M / 1000} km of the café.`;
  const r = closed(ring);
  for (let i = 0; i < r.length - 1; i++)
    for (let j = i + 2; j < r.length - 1; j++) {
      if (i === 0 && j === r.length - 2) continue; // first and last edges share a point
      if (segmentsCross(r[i], r[i + 1], r[j], r[j + 1])) return "The area's edges cross. Redraw it as a simple outline.";
    }
  return null;
}

export function inZone(p: LatLng, z: DeliveryZone, outlet: LatLng): boolean {
  if (z.kind === "radius") return !!z.radiusM && distanceMeters(outlet, p) <= z.radiusM;
  return !!z.polygon && z.polygon.length >= 3 && insidePolygon(p, z.polygon);
}

/** The zone that serves a point: active ones in their sort order, and the smallest circle first among equals. */
export function findZone(p: LatLng, zones: readonly DeliveryZone[], outlet: LatLng | null): DeliveryZone | null {
  if (!outlet || !isLatLng(p)) return null;
  const order = [...zones].filter((z) => z.active).sort((a, b) => a.sort - b.sort || (a.radiusM ?? Infinity) - (b.radiusM ?? Infinity));
  return order.find((z) => inZone(p, z, outlet)) ?? null;
}

export type DeliveryCheck =
  | { ok: true; zone: DeliveryZone | null; feePaise: number; minOrderPaise: number; etaMinutes: number | null }
  | { ok: false; reason: "no_location" | "outside" | "pincode" };

/**
 * Can this address get delivery, and on what terms? With zones set up, the pin decides. Without any active zone the
 * outlet's pincode list applies, as before zones existed, using the store-wide fee.
 */
export function checkDelivery(args: {
  point: LatLng | null;
  pincode: string;
  zones: readonly DeliveryZone[];
  outlet: LatLng | null;
  pincodes: readonly string[];
  storeFeePaise: number;
  storeMinOrderPaise: number;
}): DeliveryCheck {
  const active = args.zones.filter((z) => z.active);
  if (active.length && args.outlet) {
    if (!args.point || !isLatLng(args.point)) return { ok: false, reason: "no_location" };
    const zone = findZone(args.point, active, args.outlet);
    if (!zone) return { ok: false, reason: "outside" };
    return { ok: true, zone, feePaise: zone.feePaise, minOrderPaise: Math.max(zone.minOrderPaise, args.storeMinOrderPaise), etaMinutes: zone.etaMinutes };
  }
  if (!isServiceable(args.pincode, args.pincodes)) return { ok: false, reason: "pincode" };
  return { ok: true, zone: null, feePaise: args.storeFeePaise, minOrderPaise: args.storeMinOrderPaise, etaMinutes: null };
}
