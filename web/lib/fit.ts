import type { ParkRow } from "./types";

export type FitBox = {
  min_sites?: number | null;
  max_sites?: number | null;
  kinds?: string[] | null;
  counties?: string[] | null;
  max_miles?: number | null;
  min_years_held?: number | null;
};

export function heldYears(park: ParkRow): number | null {
  const why = String(park.score_components?.owner?.why ?? "");
  const match = /held about (\d+) years/.exec(why);
  return match ? Number(match[1]) : null;
}

function miles(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function fitScore(park: ParkRow, box: FitBox, managed: { lat: number | null; lon: number | null }[] = []) {
  const drivers: { label: string; points: number }[] = [];
  let score = 0;
  const units = park.units ?? 0;
  const min = box.min_sites ?? 0;
  const max = box.max_sites ?? 100000;
  if (units >= min && units <= max) {
    score += 25;
    drivers.push({ label: "Site count is inside the box", points: 25 });
  } else drivers.push({ label: "Site count is outside the box", points: 0 });
  if (!box.kinds?.length || box.kinds.includes(park.kind)) {
    score += 15;
    drivers.push({ label: "Park type is in the box", points: 15 });
  }
  const counties = (box.counties ?? []).map((c) => c.toLowerCase());
  if (!counties.length || counties.includes((park.county ?? "").toLowerCase())) {
    score += 15;
    drivers.push({ label: "County is in the box", points: 15 });
  }
  const held = heldYears(park);
  if (box.min_years_held && held != null && held >= box.min_years_held) {
    score += 15;
    drivers.push({ label: `Held about ${held} years`, points: 15 });
  } else if (box.min_years_held) drivers.push({ label: "Years held is not on the record, or it is under the box", points: 0 });
  const pins = managed.filter((p) => p.lat != null && p.lon != null) as { lat: number; lon: number }[];
  if (park.lat != null && park.lon != null && pins.length && box.max_miles) {
    const near = Math.min(...pins.map((pin) => miles({ lat: park.lat as number, lon: park.lon as number }, pin)));
    if (near <= box.max_miles) {
      score += 20;
      drivers.push({ label: `About ${near.toFixed(0)} miles from a park we run`, points: 20 });
    } else drivers.push({ label: `About ${near.toFixed(0)} miles from a park we run`, points: 0 });
  } else drivers.push({ label: "Distance counts once a park is marked managed", points: 0 });
  if (park.flood_zone && /^(A|V)/i.test(park.flood_zone)) drivers.push({ label: `Flood zone ${park.flood_zone} is on the record`, points: 0 });
  else {
    score += 10;
    drivers.push({ label: "No special flood zone on the record", points: 10 });
  }
  return { score: Math.min(100, score), drivers };
}
