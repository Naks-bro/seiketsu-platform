"use client";

import { useRef, useState } from "react";
import { distanceMeters, MAX_ZONE_REACH_M, type DeliveryZone, type LatLng } from "@seiketsu/core/delivery-zones";
import { MapView, type MapHandle } from "@/components/site/map/map-view";
import { PlaceSearch } from "@/components/site/map/place-search";
import { deleteZoneAction, saveZoneAction, setOutletLocationAction, type ZoneResult } from "@/app/admin/zone-actions";
import { formatINR } from "@/lib/format";

const MUMBAI: LatLng = { lat: 19.076, lng: 72.8777 };
const box = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-berry";

type Draft = {
  id?: string;
  name: string;
  kind: "radius" | "polygon";
  radiusKm: number;
  points: [number, number][];
  fee: string;
  min: string;
  eta: string;
  active: boolean;
  sort: number;
};

const blank = (sort: number): Draft => ({ name: "", kind: "radius", radiusKm: 2, points: [], fee: "0", min: "0", eta: "", active: true, sort });

const fromZone = (z: DeliveryZone): Draft => ({
  id: z.id,
  name: z.name,
  kind: z.kind,
  radiusKm: (z.radiusM ?? 2000) / 1000,
  points: z.polygon ? z.polygon.slice(0, z.polygon.length > 3 && z.polygon[0][0] === z.polygon.at(-1)![0] && z.polygon[0][1] === z.polygon.at(-1)![1] ? -1 : undefined) : [],
  fee: String(z.feePaise / 100),
  min: String(z.minOrderPaise / 100),
  eta: z.etaMinutes ? String(z.etaMinutes) : "",
  active: z.active,
  sort: z.sort,
});

/**
 * Delivery zones on a map: set the café's pin, then add circles (a radius from the café) or draw areas by tapping
 * points. Each zone has its own fee, minimum order and delivery time. Customers' pins are checked against these.
 */
export function ZonesEditor({ initialZones, initialLocation, counts }: { initialZones: DeliveryZone[]; initialLocation: LatLng | null; counts: Record<string, number> }) {
  const map = useRef<MapHandle>(null);
  const [zones, setZones] = useState(initialZones);
  const [location, setLocation] = useState(initialLocation);
  const [placing, setPlacing] = useState(!initialLocation);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function apply(r: ZoneResult, message: string) {
    if (!r.ok) return setError(r.error);
    setZones(r.zones);
    setLocation(r.location);
    setError(null);
    setOk(message);
    setTimeout(() => setOk(null), 2500);
  }

  async function saveLocation() {
    const c = map.current?.center();
    if (!c) return;
    setBusy(true);
    const r = await setOutletLocationAction(c);
    setBusy(false);
    apply(r, "Café location saved.");
    if (r.ok) setPlacing(false);
  }

  async function saveDraft() {
    if (!draft) return;
    setBusy(true);
    const r = await saveZoneAction({
      id: draft.id,
      name: draft.name,
      kind: draft.kind,
      radiusM: draft.kind === "radius" ? Math.round(draft.radiusKm * 1000) : null,
      polygon: draft.kind === "polygon" ? draft.points : null,
      feeRupees: Number(draft.fee || 0),
      minOrderRupees: Number(draft.min || 0),
      etaMinutes: draft.eta ? Number(draft.eta) : null,
      active: draft.active,
      sort: draft.sort,
    });
    setBusy(false);
    apply(r, draft.id ? "Zone updated." : "Zone added.");
    if (r.ok) setDraft(null);
  }

  async function remove(z: DeliveryZone) {
    if (!confirm(`Delete the zone "${z.name}"? Customers there will no longer be able to order delivery.`)) return;
    setBusy(true);
    apply(await deleteZoneAction(z.id), "Zone deleted.");
    setBusy(false);
  }

  async function toggle(z: DeliveryZone) {
    setBusy(true);
    apply(
      await saveZoneAction({ id: z.id, name: z.name, kind: z.kind, radiusM: z.radiusM, polygon: z.polygon, feeRupees: z.feePaise / 100, minOrderRupees: z.minOrderPaise / 100, etaMinutes: z.etaMinutes, active: !z.active, sort: z.sort }),
      z.active ? "Zone paused." : "Zone switched on.",
    );
    setBusy(false);
  }

  // The draft is drawn with the saved zones so you can see it in place.
  const preview: DeliveryZone[] = [
    ...zones.filter((z) => z.id !== draft?.id),
    ...(draft && (draft.kind === "radius" || draft.points.length >= 3)
      ? [{ id: "draft", name: draft.name || "New zone", kind: draft.kind, radiusM: Math.round(draft.radiusKm * 1000), polygon: draft.points, feePaise: 0, minOrderPaise: 0, etaMinutes: null, active: true, sort: 0 }]
      : []),
  ];
  const markers = [
    ...(location && !placing ? [{ ...location, kind: "outlet" as const }] : []),
    ...(draft?.kind === "polygon" ? draft.points.map(([lng, lat]) => ({ lat, lng, kind: "vertex" as const })) : []),
  ];
  const drawing = draft?.kind === "polygon";
  const tooFar = drawing && location ? draft.points.some(([lng, lat]) => distanceMeters(location, { lat, lng }) > MAX_ZONE_REACH_M) : false;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Delivery zones on the map</h2>
          <p className="text-sm text-muted">With zones set up, the customer&apos;s map pin decides delivery and the zone sets the fee. Without zones, the pincode list below applies.</p>
        </div>
        {location && !placing && !draft && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setPlacing(true)} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-medium hover:bg-paper">
              Move café pin
            </button>
            <button type="button" onClick={() => setDraft(blank(zones.length))} className="rounded-full bg-berry px-4 py-2 text-sm font-semibold text-cream hover:bg-berry-deep">
              + Add zone
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-2">
          <PlaceSearch
            floating
            near={location ?? MUMBAI}
            onPick={(p) => map.current?.flyTo({ lat: p.lat, lng: p.lng }, placing ? 18 : 15)}
            placeholder={placing ? "Search for the café's address…" : "Search an area to look at…"}
            className="z-20"
          />
          <MapView
            ref={map}
            center={location ?? MUMBAI}
            zoom={location ? 13 : 11}
            pin={placing}
            zones={preview}
            outlet={location}
            markers={markers}
            controls
            onClick={drawing ? (p) => setDraft((d) => (d ? { ...d, points: [...d.points, [p.lng, p.lat]] } : d)) : undefined}
            className="h-[420px] rounded-2xl border border-line lg:h-[560px]"
          />
          {placing ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-berry/30 bg-white p-4 text-sm">
              <span>Move the map so the pin sits exactly on the café, then save.</span>
              <span className="flex gap-2">
                {location && (
                  <button type="button" onClick={() => setPlacing(false)} className="rounded-full px-4 py-2 font-medium text-muted hover:bg-paper">
                    Cancel
                  </button>
                )}
                <button type="button" disabled={busy} onClick={saveLocation} className="rounded-full bg-berry px-4 py-2 font-semibold text-cream hover:bg-berry-deep disabled:opacity-50">
                  Save café location
                </button>
              </span>
            </div>
          ) : drawing ? (
            <p className="text-sm text-muted">Tap the map to add points around the area. {draft.points.length} point{draft.points.length === 1 ? "" : "s"} so far.</p>
          ) : null}
        </div>

        <div className="space-y-3">
          {draft ? (
            <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
              <p className="font-semibold">{draft.id ? "Edit zone" : "New zone"}</p>
              <label className="block text-sm">
                <span className="font-medium">Name</span>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`${box} mt-1`} placeholder="e.g. Versova 2 km" />
              </label>
              <div role="radiogroup" aria-label="Zone shape" className="flex gap-1 rounded-full border border-line bg-paper p-1 text-sm">
                {(["radius", "polygon"] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={draft.kind === k} onClick={() => setDraft({ ...draft, kind: k })} className={`flex-1 rounded-full py-1.5 font-medium ${draft.kind === k ? "bg-white shadow-sm" : "text-muted"}`}>
                    {k === "radius" ? "Distance from café" : "Draw an area"}
                  </button>
                ))}
              </div>
              {draft.kind === "radius" ? (
                <label className="block text-sm">
                  <span className="font-medium">Radius: {draft.radiusKm.toFixed(1)} km</span>
                  <input type="range" min={0.5} max={15} step={0.1} value={draft.radiusKm} onChange={(e) => setDraft({ ...draft, radiusKm: Number(e.target.value) })} className="mt-2 w-full accent-[var(--color-berry)]" />
                </label>
              ) : (
                <div className="flex gap-2 text-sm">
                  <button type="button" disabled={!draft.points.length} onClick={() => setDraft({ ...draft, points: draft.points.slice(0, -1) })} className="rounded-full border border-line px-3 py-1.5 hover:bg-paper disabled:opacity-40">
                    Undo point
                  </button>
                  <button type="button" disabled={!draft.points.length} onClick={() => setDraft({ ...draft, points: [] })} className="rounded-full border border-line px-3 py-1.5 hover:bg-paper disabled:opacity-40">
                    Clear
                  </button>
                </div>
              )}
              {tooFar && <p className="text-sm text-nonveg">Some points are more than {MAX_ZONE_REACH_M / 1000} km from the café.</p>}
              <div className="grid grid-cols-3 gap-2">
                <label className="block text-sm">
                  <span className="font-medium">Fee ₹</span>
                  <input type="number" min={0} inputMode="numeric" value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} className={`${box} mt-1`} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Min order ₹</span>
                  <input type="number" min={0} inputMode="numeric" value={draft.min} onChange={(e) => setDraft({ ...draft, min: e.target.value })} className={`${box} mt-1`} />
                </label>
                <label className="block text-sm">
                  <span className="font-medium">Time (min)</span>
                  <input type="number" min={5} inputMode="numeric" value={draft.eta} onChange={(e) => setDraft({ ...draft, eta: e.target.value })} className={`${box} mt-1`} placeholder="—" />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="size-4 accent-[var(--color-berry)]" />
                Taking orders in this zone
              </label>
              <p className="text-xs text-muted">If zones overlap, the one higher in the list wins; between two circles, the smaller one.</p>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setDraft(null)} className="rounded-full px-4 py-2 text-sm font-medium text-muted hover:bg-paper">
                  Cancel
                </button>
                <button type="button" disabled={busy} onClick={saveDraft} className="rounded-full bg-berry px-5 py-2 text-sm font-semibold text-cream hover:bg-berry-deep disabled:opacity-50">
                  {busy ? "Saving…" : "Save zone"}
                </button>
              </div>
            </div>
          ) : zones.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white/60 p-6 text-sm text-muted">
              {location ? "No zones yet. Add one to start taking delivery orders by map pin." : "First set the café's location on the map."}
            </div>
          ) : (
            <ul className="space-y-2">
              {zones.map((z) => (
                <li key={z.id} className={`rounded-2xl border bg-white p-4 ${z.active ? "border-line" : "border-dashed border-line opacity-70"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{z.name}</p>
                      <p className="text-sm text-muted">
                        {z.kind === "radius" ? `Within ${((z.radiusM ?? 0) / 1000).toFixed(1)} km` : `Drawn area · ${Math.max(0, (z.polygon?.length ?? 1) - 1)} points`}
                        {" · "}
                        {z.feePaise ? `${formatINR(z.feePaise)} fee` : "Free delivery"}
                        {z.minOrderPaise ? ` · min ${formatINR(z.minOrderPaise)}` : ""}
                        {z.etaMinutes ? ` · ~${z.etaMinutes} min` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted">{counts[z.id] ?? 0} orders in the last 30 days</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${z.active ? "bg-veg/10 text-veg" : "bg-paper text-muted"}`}>{z.active ? "On" : "Paused"}</span>
                  </div>
                  <div className="mt-3 flex gap-2 text-sm">
                    <button type="button" disabled={busy} onClick={() => setDraft(fromZone(z))} className="rounded-full border border-line px-3 py-1.5 font-medium hover:bg-paper">
                      Edit
                    </button>
                    <button type="button" disabled={busy} onClick={() => toggle(z)} className="rounded-full border border-line px-3 py-1.5 font-medium hover:bg-paper">
                      {z.active ? "Pause" : "Switch on"}
                    </button>
                    <button type="button" disabled={busy} onClick={() => remove(z)} className="ml-auto rounded-full px-3 py-1.5 font-medium text-nonveg hover:bg-nonveg/10">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error && <p role="alert" className="rounded-xl bg-nonveg/10 p-3 text-sm text-nonveg">{error}</p>}
          {ok && <p role="status" className="rounded-xl bg-veg/10 p-3 text-sm text-veg">{ok}</p>}
        </div>
      </div>
    </section>
  );
}
