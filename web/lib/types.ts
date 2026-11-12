export type ScoreComponent = {
  points: number | null;
  why?: string | null;
  [key: string]: unknown;
};

export type ParkRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  county: string | null;
  lat: number | null;
  lon: number | null;
  kind: "mhp" | "rv" | "mixed" | "unknown";
  units: number | null;
  phone?: string | null;
  email?: string | null;
  owner_email?: string | null;
  website?: string | null;
  owner_id: string | null;
  owner_name: string | null;
  owner_entity_type: string | null;
  owner_city: string | null;
  owner_state: string | null;
  owner_park_count: number | null;
  flood_zone?: string | null;
  managed?: boolean | null;
  score: number | null;
  score_components: Record<string, ScoreComponent> | null;
  loan_id: string | null;
  loan_source: string | null;
  loan_status: string | null;
  original_amount: number | null;
  current_balance: number | null;
  note_rate: number | null;
  origination_date: string | null;
  recording_date: string | null;
  lender_name: string | null;
  lender_name_raw: string | null;
  lender_kind: string | null;
  maturity_date: string | null;
  maturity_basis: "reported" | "document" | "estimated" | "unknown" | null;
  maturity_explanation: string | null;
  p10_date: string | null;
  p90_date: string | null;
  prob_12m: number | null;
  prob_24m: number | null;
  last_activity_at: string | null;
};

export const KIND_LABEL: Record<string, string> = { mhp: "MH park", rv: "RV park", mixed: "MH + RV", unknown: "Park" };

export const LENDER_LABEL: Record<string, string> = {
  community_bank: "Community bank",
  regional_bank: "Regional bank",
  national_bank: "National bank",
  credit_union: "Credit union",
  agency_fannie: "Fannie Mae",
  agency_freddie: "Freddie Mac",
  agency_lender: "Agency lender",
  cmbs_trust: "CMBS",
  conduit_lender: "Conduit lender",
  life_company: "Life company",
  debt_fund: "Debt fund",
  sba_lender: "SBA",
  individual: "Private / seller",
  government: "Government",
  unknown: "Unknown lender",
};

export const BASIS_LABEL: Record<string, string> = {
  reported: "Reported",
  document: "From document",
  estimated: "Estimated",
  unknown: "Unknown",
};
