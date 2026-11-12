"use client";

import { useEffect, useRef } from "react";
import type { Map as MlMap, GeoJSONSource } from "maplibre-gl";
import { shownPressure } from "@/lib/brief";
import type { ParkRow } from "@/lib/types";

const STYLE = process.env.NEXT_PUBLIC_MAP_STYLE || "https://tiles.openfreemap.org/styles/positron";
// If the basemap can't be reached, still draw the parks on a plain background.
const BLANK = { version: 8 as const, sources: {}, layers: [{ id: "bg", type: "background" as const, paint: { "background-color": "#f5f5f4" } }] };

async function pickStyle() {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(STYLE, { signal: ctl.signal });
    clearTimeout(t);
    return res.ok ? STYLE : BLANK;
  } catch {
    return BLANK;
  }
}

function toGeoJson(rows: ParkRow[]) {
  return {
    type: "FeatureCollection" as const,
    features: rows
      .filter((r) => r.lat != null && r.lon != null)
      .map((r) => ({
        type: "Feature" as const,
        id: r.id,
        geometry: { type: "Point" as const, coordinates: [r.lon as number, r.lat as number] },
        properties: {
          id: r.id,
          name: r.name,
          score: shownPressure(r) ?? -1,
          units: r.units ?? 0,
          lender: r.lender_name ?? r.lender_name_raw ?? "",
          matures: r.maturity_date ?? "",
        },
      })),
  };
}

export default function ParkMap({ rows, highlight }: { rows: ParkRow[]; highlight: string | null }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const ready = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      const style = await pickStyle();
      if (cancelled || !el.current) return;
      const m = new maplibregl.Map({ container: el.current, style, center: [-111.9, 33.4], zoom: 6 });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      m.on("load", () => {
        m.addSource("parks", { type: "geojson", data: toGeoJson(rows), promoteId: "id", cluster: true, clusterRadius: 48, clusterMaxZoom: 9 });
        m.addLayer({
          id: "clusters",
          type: "circle",
          source: "parks",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#e7e5e4",
            "circle-radius": ["step", ["get", "point_count"], 14, 8, 18, 24, 24],
            "circle-stroke-width": 1,
            "circle-stroke-color": "#a8a29e",
          },
        });
        m.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "parks",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
          paint: { "text-color": "#1c1917" },
        });
        m.addLayer({
          id: "parks",
          type: "circle",
          source: "parks",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["get", "units"], 0, 4, 100, 6, 400, 11],
            "circle-color": ["step", ["get", "score"], "#a8a29e", 30, "#d97706", 45, "#c2410c", 60, "#991b1b"],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 3, 1],
            "circle-opacity": 0.9,
          },
        });
        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
        const text = (value: unknown) => String(value ?? "").replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch] ?? ch));
        m.on("click", "parks", (e) => {
          const id = e.features?.[0]?.properties?.id;
          if (id) window.location.href = `/parks/${id}`;
        });
        m.on("click", "clusters", (e) => {
          const feature = e.features?.[0];
          const source = m.getSource("parks") as GeoJSONSource;
          const clusterId = feature?.properties?.cluster_id;
          if (clusterId == null || feature?.geometry.type !== "Point") return;
          source.getClusterExpansionZoom(clusterId).then((zoom) => {
            if (feature.geometry.type !== "Point") return;
            m.easeTo({ center: feature.geometry.coordinates as [number, number], zoom });
          }).catch(() => undefined);
        });
        m.on("mousemove", "parks", (e) => {
          const props = e.features?.[0]?.properties;
          if (!props) return;
          m.getCanvas().style.cursor = "pointer";
          popup.setLngLat(e.lngLat).setHTML(
            `<div style="font: 13px sans-serif; color: #1c1917"><strong>${text(props.name)}</strong><div>Score ${Number(props.score) < 0 ? "—" : Number(props.score).toFixed(1)} · ${text(props.matures) || "no maturity"}</div><div>${text(props.lender) || "No lender"}</div></div>`,
          ).addTo(m);
        });
        m.on("mouseleave", "parks", () => {
          m.getCanvas().style.cursor = "";
          popup.remove();
        });
        m.on("mouseenter", "clusters", () => (m.getCanvas().style.cursor = "pointer"));
        m.on("mouseleave", "clusters", () => (m.getCanvas().style.cursor = ""));
        ready.current = true;
        fit(m, rows);
      });
      map.current = m;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    (m.getSource("parks") as GeoJSONSource | undefined)?.setData(toGeoJson(rows));
    fit(m, rows);
  }, [rows]);

  const prev = useRef<string | null>(null);
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    if (prev.current) m.setFeatureState({ source: "parks", id: prev.current }, { hover: false });
    if (highlight) m.setFeatureState({ source: "parks", id: highlight }, { hover: true });
    prev.current = highlight;
  }, [highlight]);

  return <div ref={el} className="h-full w-full" />;
}

function fit(m: MlMap, rows: ParkRow[]) {
  const pts = rows.filter((r) => r.lat != null && r.lon != null);
  if (!pts.length) return;
  const lons = pts.map((r) => r.lon as number);
  const lats = pts.map((r) => r.lat as number);
  m.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], {
    padding: 40, maxZoom: 12, duration: 0,
  });
}
