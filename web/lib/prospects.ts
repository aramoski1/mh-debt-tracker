import { reportedCashGap, shownPressure } from "./brief";
import { heldYears } from "./fit";
import type { ParkRow } from "./types";

const EAST_VALLEY = new Set(["mesa", "gilbert", "chandler", "tempe", "apache junction", "queen creek"]);

function milesApart(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(s)));
}

export type ProspectParams = Record<string, string | undefined>;

const LENDER_GROUPS: Record<string, string[]> = {
  bank: ["community_bank", "regional_bank", "national_bank", "credit_union"],
  agency: ["agency_fannie", "agency_freddie", "agency_lender"],
  cmbs: ["cmbs_trust", "conduit_lender"],
  private: ["individual", "debt_fund"],
};

type Filterable = {
  eq: (column: string, value: unknown) => Filterable;
  gte: (column: string, value: number) => Filterable;
  lte: (column: string, value: number | string) => Filterable;
  in: (column: string, values: unknown[]) => Filterable;
  is: (column: string, value: null) => Filterable;
  or: (filters: string) => Filterable;
};

/** The filters the prospect URL already applies in the database. */
export function applyProspectFilters<T extends Filterable>(q: T, sp: ProspectParams): T {
  let next: Filterable = q.eq("state", sp.state || "AZ");
  if (sp.kind) next = next.eq("kind", sp.kind);
  if (sp.minUnits) next = next.gte("units", Number(sp.minUnits));
  if (sp.maxUnits) next = next.lte("units", Number(sp.maxUnits));
  if (sp.minScore) next = next.gte("score", Number(sp.minScore));
  if (sp.lender && LENDER_GROUPS[sp.lender]) next = next.in("lender_kind", LENDER_GROUPS[sp.lender]);
  if (sp.lender === "none") next = next.is("loan_id", null);
  if (sp.basis === "known") next = next.in("maturity_basis", ["reported", "document"]);
  if (sp.window) {
    const end = new Date();
    end.setMonth(end.getMonth() + Number(sp.window));
    next = next.lte("maturity_date", end.toISOString().slice(0, 10));
  }
  const term = (sp.q ?? "").replace(/[,()%*]/g, " ").trim();
  if (term) next = next.or(`name.ilike.%${term}%,owner_name.ilike.%${term}%,city.ilike.%${term}%`);
  return next as T;
}

/** Filters the database query cannot express, applied to the rows it returned. */
export function narrowProspects(rows: ParkRow[], sp: ProspectParams, pins: { lat: number | null; lon: number | null }[] = []) {
  const located = pins.filter((pin) => pin.lat != null && pin.lon != null) as { lat: number; lon: number }[];
  return rows.filter((park) => {
    if (sp.minScore) {
      const pressure = shownPressure(park);
      if (pressure == null || pressure < Number(sp.minScore)) return false;
    }
    if (sp.county && !(park.county ?? "").toLowerCase().includes(sp.county.toLowerCase().replace(/ county$/, ""))) return false;
    if (sp.city) {
      const have = (park.city ?? "").toLowerCase();
      const want = sp.city.toLowerCase();
      if (have !== want && !have.startsWith(want) && !want.startsWith(have)) return false;
    }
    if (sp.region === "east" && !EAST_VALLEY.has((park.city ?? "").toLowerCase())) return false;
    if (sp.status === "foreclosure" && park.loan_status !== "foreclosure") return false;
    if (sp.minParks && (park.owner_park_count ?? 0) < Number(sp.minParks)) return false;
    if (sp.owner === "out" && (!park.owner_state || park.owner_state === "AZ")) return false;
    if (sp.assumable === "1" && !(park.lender_kind ?? "").startsWith("agency")) return false;
    if (sp.shock) {
      const pts = Number(park.score_components?.rate_shock?.shock_pct_pts);
      if (!Number.isFinite(pts) || pts * 100 < Number(sp.shock)) return false;
    }
    if (sp.gap) {
      const gap = reportedCashGap(park);
      if (gap == null || gap < Number(sp.gap)) return false;
    }
    if (sp.held) {
      const years = heldYears(park);
      if (years == null || years < Number(sp.held)) return false;
    }
    if (sp.staleDays) {
      if (park.last_activity_at) {
        const days = (Date.now() - new Date(park.last_activity_at).getTime()) / 86_400_000;
        if (days < Number(sp.staleDays)) return false;
      }
    }
    if (sp.miles && located.length && park.lat != null && park.lon != null) {
      const near = Math.min(...located.map((pin) => milesApart({ lat: park.lat as number, lon: park.lon as number }, pin)));
      if (near > Number(sp.miles)) return false;
    }
    return true;
  });
}
