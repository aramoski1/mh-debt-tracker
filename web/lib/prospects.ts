import type { ParkRow } from "./types";

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
export function narrowProspects(rows: ParkRow[], sp: ProspectParams) {
  return rows.filter((park) => {
    if (sp.county && !(park.county ?? "").toLowerCase().includes(sp.county.toLowerCase().replace(/ county$/, ""))) return false;
    if (sp.city) {
      const have = (park.city ?? "").toLowerCase();
      const want = sp.city.toLowerCase();
      if (have !== want && !have.startsWith(want) && !want.startsWith(have)) return false;
    }
    if (sp.status === "foreclosure" && park.loan_status !== "foreclosure") return false;
    if (sp.minParks && (park.owner_park_count ?? 0) < Number(sp.minParks)) return false;
    if (sp.owner === "out" && (!park.owner_state || park.owner_state === "AZ")) return false;
    return true;
  });
}
