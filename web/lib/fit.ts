import type { ParkRow } from "./types";

export type FitBox = {
  min_sites?: number | null;
  max_sites?: number | null;
  states?: string[] | null;
  kinds?: string[] | null;
};

export type FitPart = { key: string; points: number; max: number; why: string };

/** Same weights as pipeline/mhdebt/scoring.py acquisition_fit. */
export function acquisitionFit(input: {
  units: number | null;
  state: string | null;
  kind: string | null;
  noteRate: number | null;
  marketRate: number | null;
  kmToManaged: number | null;
  minSites?: number;
  maxSites?: number;
  states?: string[];
  kinds?: string[];
}): { points: number; parts: FitPart[] } {
  const minSites = input.minSites ?? 50;
  const maxSites = input.maxSites ?? 400;
  const states = (input.states ?? ["AZ"]).map((s) => s.toUpperCase());
  const kinds = input.kinds?.length ? input.kinds : ["mhp", "rv", "mixed"];
  const parts: FitPart[] = [];
  if (input.units == null) parts.push({ key: "size", points: 0, max: 25, why: "Site count is unknown." });
  else if (input.units >= minSites && input.units <= maxSites) {
    parts.push({ key: "size", points: 25, max: 25, why: `${input.units} sites is inside ${minSites}-${maxSites}.` });
  } else parts.push({ key: "size", points: 0, max: 25, why: `${input.units} sites is outside ${minSites}-${maxSites}.` });
  const st = (input.state ?? "").toUpperCase();
  parts.push({
    key: "state", points: states.includes(st) ? 20 : 0, max: 20,
    why: `${st || "Unknown state"} ${states.includes(st) ? "is" : "is not"} in the buy box.`,
  });
  const kindOk = input.kind != null && kinds.includes(input.kind);
  parts.push({
    key: "kind", points: kindOk ? 15 : 0, max: 15,
    why: `${input.kind || "unknown"} ${kindOk ? "is" : "is not"} a type the box wants.`,
  });
  if (input.noteRate == null || input.marketRate == null) {
    parts.push({ key: "rate", points: 0, max: 20, why: "No note rate to compare with today's rate." });
  } else if (input.noteRate + 0.5 <= input.marketRate) {
    parts.push({
      key: "rate", points: 20, max: 20,
      why: `Note rate ${input.noteRate.toFixed(2)}% is at least half a point inside today's ${input.marketRate.toFixed(2)}%.`,
    });
  } else {
    parts.push({
      key: "rate", points: 0, max: 20,
      why: `Note rate ${input.noteRate.toFixed(2)}% is not inside today's ${input.marketRate.toFixed(2)}%.`,
    });
  }
  if (input.kmToManaged == null) {
    parts.push({ key: "distance", points: 0, max: 20, why: "No managed park is marked, so distance is not scored." });
  } else if (input.kmToManaged <= 40) {
    parts.push({
      key: "distance", points: 20, max: 20,
      why: `About ${(input.kmToManaged / 1.609).toFixed(0)} miles from a managed park.`,
    });
  } else {
    parts.push({
      key: "distance", points: 0, max: 20,
      why: `About ${(input.kmToManaged / 1.609).toFixed(0)} miles from the nearest managed park.`,
    });
  }
  return { points: parts.reduce((sum, part) => sum + part.points, 0), parts };
}

export function heldYears(park: ParkRow): number | null {
  const why = String(park.score_components?.owner?.why ?? "");
  const match = /held about (\d+) years/.exec(why);
  return match ? Number(match[1]) : null;
}

function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function fitScore(park: ParkRow, box: FitBox, managed: { lat: number | null; lon: number | null }[] = []) {
  const pins = managed.filter((p) => p.lat != null && p.lon != null) as { lat: number; lon: number }[];
  const km = park.lat != null && park.lon != null && pins.length
    ? Math.min(...pins.map((pin) => kmBetween({ lat: park.lat as number, lon: park.lon as number }, pin)))
    : null;
  const market = park.score_components?.rate_shock?.new_rate;
  const got = acquisitionFit({
    units: park.units ?? null,
    state: park.state ?? null,
    kind: park.kind ?? null,
    noteRate: park.note_rate ?? null,
    marketRate: typeof market === "number" ? market : null,
    kmToManaged: km,
    minSites: box.min_sites ?? 50,
    maxSites: box.max_sites ?? 400,
    states: box.states ?? undefined,
    kinds: box.kinds ?? undefined,
  });
  return { score: got.points, drivers: got.parts.map((part) => ({ label: part.why, points: part.points })) };
}
