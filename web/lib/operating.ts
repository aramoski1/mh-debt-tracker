// Mirrors pipeline/mhdebt/operating.py: the newest non-empty value of each field wins, and the fill rate comes from
// a stated occupancy or from sites and vacancy.

export type OperatingRow = {
  id: string;
  source: string;
  source_ref: string | null;
  observed_on: string;
  rent_current: number | null;
  rent_jan_this: number | null;
  rent_jan_last: number | null;
  rent_jan_prior: number | null;
  total_sites: number | null;
  vacant_sites: number | null;
  dev_sites: number | null;
  park_owned_homes: number | null;
  empty_homes: number | null;
  occupancy_pct: number | null;
  rv_share_pct: number | null;
  age_restricted: boolean | null;
  year_built: number | null;
  land_tenure: "owned" | "leased" | null;
  owned_since: string | null;
  amenities: string | null;
  notes: string | null;
  entered_by_name: string | null;
  created_at: string;
};

type Field = Exclude<keyof OperatingRow, "id" | "source" | "source_ref" | "observed_on" | "entered_by_name" | "created_at" | "notes">;

export type Merged = { [K in Field]?: { value: NonNullable<OperatingRow[K]>; source: string; on: string } };

/** rows newest first (observed_on desc, created_at desc). */
export function mergeOperating(rows: OperatingRow[]): Merged {
  const out: Merged = {};
  for (const r of rows) {
    for (const k of Object.keys(r) as (keyof OperatingRow)[]) {
      if (["id", "source", "source_ref", "observed_on", "entered_by_name", "created_at", "notes"].includes(k)) continue;
      const v = r[k];
      if (v === null || v === "" || k in out) continue;
      const label = r.source === "manual" ? r.entered_by_name ?? "manual entry" : r.source;
      (out as Record<string, unknown>)[k] = { value: typeof v === "string" && !isNaN(Number(v)) && k !== "owned_since" ? Number(v) : v, source: label, on: r.observed_on };
    }
  }
  return out;
}

export function occupancy(m: Merged): number | null {
  if (m.occupancy_pct) return Number(m.occupancy_pct.value) / 100;
  const total = m.total_sites?.value;
  const vacant = m.vacant_sites?.value;
  if (!total || vacant == null) return null;
  const rentable = total - (m.dev_sites?.value ?? 0);
  return rentable > 0 ? Math.max(0, Math.min(1, (rentable - vacant) / rentable)) : null;
}
