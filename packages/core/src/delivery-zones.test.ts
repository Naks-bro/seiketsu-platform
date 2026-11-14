import { describe, expect, it } from "vitest";
import { checkDelivery, distanceMeters, findZone, insidePolygon, zoneProblem, type DeliveryZone } from "./delivery-zones";

// Synthetic points around Versova, Mumbai.
const cafe = { lat: 19.1307, lng: 72.8195 };
const near = { lat: 19.1335, lng: 72.8195 }; // ~310 m north
const far = { lat: 19.17, lng: 72.8195 }; // ~4.4 km north

const zone = (z: Partial<DeliveryZone>): DeliveryZone => ({
  id: "z",
  name: "Zone",
  kind: "radius",
  radiusM: 1000,
  polygon: null,
  feePaise: 0,
  minOrderPaise: 0,
  etaMinutes: null,
  active: true,
  sort: 0,
  ...z,
});

const square: [number, number][] = [
  [72.81, 19.12],
  [72.83, 19.12],
  [72.83, 19.14],
  [72.81, 19.14],
];

describe("delivery zones", () => {
  it("measures distance", () => {
    expect(distanceMeters(cafe, near)).toBeGreaterThan(290);
    expect(distanceMeters(cafe, near)).toBeLessThan(330);
  });

  it("finds points inside a drawn area, edges included", () => {
    expect(insidePolygon(cafe, square)).toBe(true);
    expect(insidePolygon(far, square)).toBe(false);
    expect(insidePolygon({ lat: 19.13, lng: 72.81 }, square)).toBe(true);
  });

  it("picks the zone by sort order, then the smaller circle", () => {
    const zones = [zone({ id: "wide", radiusM: 5000, feePaise: 4000 }), zone({ id: "close", radiusM: 1000, feePaise: 0 }), zone({ id: "off", radiusM: 9000, active: false })];
    expect(findZone(near, zones, cafe)?.id).toBe("close");
    expect(findZone(far, zones, cafe)?.id).toBe("wide");
    expect(findZone({ lat: 19.2, lng: 72.8195 }, zones, cafe)).toBeNull();
  });

  it("rejects bad zones", () => {
    expect(zoneProblem({ name: "", kind: "radius", radiusM: 1000, polygon: null }, cafe)).toMatch(/name/);
    expect(zoneProblem({ name: "A", kind: "radius", radiusM: 50, polygon: null }, cafe)).toMatch(/100 m/);
    expect(zoneProblem({ name: "A", kind: "radius", radiusM: 1000, polygon: null }, null)).toMatch(/location/);
    expect(zoneProblem({ name: "A", kind: "polygon", radiusM: null, polygon: square.slice(0, 2) }, cafe)).toMatch(/3 points/);
    const bowtie: [number, number][] = [square[0], square[2], square[1], square[3]];
    expect(zoneProblem({ name: "A", kind: "polygon", radiusM: null, polygon: bowtie }, cafe)).toMatch(/cross/);
    expect(zoneProblem({ name: "A", kind: "polygon", radiusM: null, polygon: square }, cafe)).toBeNull();
  });

  it("uses the pin when zones exist, and the pincode list otherwise", () => {
    const base = { pincode: "400061", outlet: cafe, pincodes: ["400061"], storeFeePaise: 2000, storeMinOrderPaise: 10000 };
    const zones = [zone({ feePaise: 3000, minOrderPaise: 5000, etaMinutes: 30 })];
    expect(checkDelivery({ ...base, zones, point: near })).toMatchObject({ ok: true, feePaise: 3000, minOrderPaise: 10000, etaMinutes: 30 });
    expect(checkDelivery({ ...base, zones, point: far })).toEqual({ ok: false, reason: "outside" });
    expect(checkDelivery({ ...base, zones, point: null })).toEqual({ ok: false, reason: "no_location" });
    expect(checkDelivery({ ...base, zones: [], point: null })).toMatchObject({ ok: true, zone: null, feePaise: 2000 });
    expect(checkDelivery({ ...base, zones: [], point: null, pincode: "400001" })).toEqual({ ok: false, reason: "pincode" });
  });
});
