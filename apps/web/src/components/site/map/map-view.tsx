"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import type { DeliveryZone, LatLng } from "@seiketsu/core/delivery-zones";

/** Free OpenStreetMap vector tiles: no key, no account, no usage limits. */
export const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export type MapHandle = { flyTo: (p: LatLng, zoom?: number) => void; center: () => LatLng | null };

/** A circle as a polygon ring, for drawing radius zones. */
export function circleRing(c: LatLng, radiusM: number, steps = 64): [number, number][] {
  const out: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    out.push([c.lng + dLng * Math.cos(t), c.lat + dLat * Math.sin(t)]);
  }
  return out;
}

export function zonesGeoJson(zones: readonly DeliveryZone[], outlet: LatLng | null) {
  return {
    type: "FeatureCollection" as const,
    features: zones
      .map((z) => {
        const ring = z.kind === "radius" ? (outlet && z.radiusM ? circleRing(outlet, z.radiusM) : null) : z.polygon && z.polygon.length >= 3 ? [...z.polygon, z.polygon[0]] : null;
        return ring ? { type: "Feature" as const, properties: { id: z.id, name: z.name, active: z.active }, geometry: { type: "Polygon" as const, coordinates: [ring] } } : null;
      })
      .filter((f) => f !== null),
  };
}

type Props = {
  center: LatLng;
  zoom?: number;
  zones?: readonly DeliveryZone[];
  outlet?: LatLng | null;
  /** The fixed centre pin customers move the map under. */
  pin?: boolean;
  /** Called when the map stops moving, with the point under the centre pin. */
  onMove?: (center: LatLng) => void;
  onClick?: (p: LatLng) => void;
  /** Small dots on the map: the café, or the points of an area being drawn. */
  markers?: { lat: number; lng: number; kind: "outlet" | "vertex" }[];
  /** Zoom buttons (pinch and scroll always work). Off where a search box sits over the map. */
  controls?: boolean;
  className?: string;
  ref?: Ref<MapHandle>;
  children?: React.ReactNode;
};

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function MapView({ center, zoom = 16, zones = [], outlet = null, pin = false, onMove, onClick, markers = [], controls = false, className = "", ref, children }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const handlers = useRef({ onMove, onClick });
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const placed = useRef<Marker[]>([]);
  const [moving, setMoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    handlers.current = { onMove, onClick };
  });

  useImperativeHandle(ref, () => ({
    flyTo: (p, z) => map.current?.flyTo({ center: [p.lng, p.lat], zoom: z ?? Math.max(map.current.getZoom(), 16), animate: !reduceMotion(), essential: true }),
    center: () => {
      const c = map.current?.getCenter();
      return c ? { lat: c.lat, lng: c.lng } : null;
    },
  }));

  useEffect(() => {
    let alive = true;
    let m: MlMap | null = null;
    import("maplibre-gl")
      .then((ml) => {
        if (!alive || !el.current) return;
        lib.current = ml;
        // Served from our own origin (copied there at build time), as the bundler does not emit it.
        ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        const inst = new ml.Map({ container: el.current, style: MAP_STYLE, center: [center.lng, center.lat], zoom, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
        m = inst;
        inst.touchZoomRotate.disableRotation();
        if (controls) inst.addControl(new ml.NavigationControl({ showCompass: false }), "top-right");
        inst.on("movestart", () => setMoving(true));
        inst.on("moveend", () => {
          setMoving(false);
          const c = inst.getCenter();
          handlers.current.onMove?.({ lat: c.lat, lng: c.lng });
        });
        inst.on("click", (e) => handlers.current.onClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
        inst.on("load", () => {
          if (!alive) return;
          inst.addSource("zones", { type: "geojson", data: zonesGeoJson([], null) });
          inst.addLayer({ id: "zones-fill", type: "fill", source: "zones", paint: { "fill-color": "#a51c47", "fill-opacity": ["case", ["get", "active"], 0.08, 0.03] } });
          inst.addLayer({ id: "zones-line", type: "line", source: "zones", paint: { "line-color": "#a51c47", "line-width": 2, "line-opacity": 0.7, "line-dasharray": [2, 1.5] } });
          setReady(true);
        });
        inst.on("error", (e) => {
          // A missing tile is harmless; only give up if the style itself never loads.
          if (!inst.isStyleLoaded() && /style/i.test(String(e.error?.message ?? ""))) setFailed(true);
        });
        map.current = inst;
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      m?.remove();
      map.current = null;
    };
    // The map is created once; later centre changes go through flyTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw zones (and the café) whenever they change.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("zones") as { setData?: (d: unknown) => void } | undefined)?.setData?.(zonesGeoJson(zones, outlet));
  }, [ready, zones, outlet]);

  // Markers are cheap DOM dots; replace them all when the list changes.
  const markerKey = JSON.stringify(markers);
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!ready || !m || !ml) return;
    for (const mk of placed.current) mk.remove();
    placed.current = (JSON.parse(markerKey) as Props["markers"] & object).map((p) => {
      const dot = document.createElement("div");
      dot.className = p.kind === "outlet" ? "size-5 rounded-full border-[3px] border-cream bg-berry shadow-md" : "size-3 rounded-full border-2 border-berry bg-cream shadow";
      if (p.kind === "outlet") dot.title = "Café";
      return new ml.Marker({ element: dot }).setLngLat([p.lng, p.lat]).addTo(m);
    });
  }, [ready, markerKey]);

  return (
    <div className={`relative overflow-hidden bg-paper ${className}`}>
      {/* MapLibre sets position:relative on its container, so the container fills a positioned wrapper. */}
      <div className="absolute inset-0">
        <div ref={el} className="h-full w-full" />
      </div>
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">The map could not load. Check your connection and try again.</div>
      )}
      {pin && !failed && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full">
          <div className={`transition-transform duration-150 motion-reduce:transition-none ${moving ? "-translate-y-2" : ""}`}>
            <svg viewBox="0 0 40 52" className="h-12 w-10 drop-shadow-[0_4px_6px_rgba(42,24,30,.35)]" aria-hidden="true">
              <path d="M20 51s17-15.6 17-30.5A17 17 0 0 0 3 20.5C3 35.4 20 51 20 51Z" fill="#a51c47" stroke="#fffcf5" strokeWidth="2.5" />
              <circle cx="20" cy="20" r="6.5" fill="#fffcf5" />
            </svg>
          </div>
          <div className={`mx-auto -mt-1 h-1.5 w-4 rounded-full bg-ink/30 blur-[1px] transition-all duration-150 ${moving ? "w-6 opacity-50" : ""}`} />
        </div>
      )}
      {children}
    </div>
  );
}
