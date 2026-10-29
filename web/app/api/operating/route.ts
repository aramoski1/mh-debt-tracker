import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// A broker records rent, sites and vacancy for one park. Each save is a new dated row; the nightly model reads the
// newest value of each field, so leaving a field blank keeps whatever was entered before.

const MONEY = ["rent_current", "rent_jan_this", "rent_jan_last", "rent_jan_prior"] as const;
const COUNTS = ["total_sites", "vacant_sites", "dev_sites", "park_owned_homes", "empty_homes"] as const;
const PCTS = ["occupancy_pct", "rv_share_pct"] as const;

const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const b = (await req.json()) as Record<string, unknown>;
  if (typeof b.parkId !== "string") return NextResponse.json({ error: "Missing park" }, { status: 400 });

  const row: Record<string, unknown> = {
    park_id: b.parkId,
    source: "manual",
    observed_on: isoDate(b.observed_on) ?? new Date().toISOString().slice(0, 10),
    entered_by: user.id,
    entered_by_name: user.email,
  };
  for (const k of MONEY) {
    const n = num(b[k]);
    if (Number.isNaN(n) || (n != null && n < 0)) return NextResponse.json({ error: `${k.replaceAll("_", " ")} must be a dollar amount` }, { status: 400 });
    row[k] = n;
  }
  for (const k of COUNTS) {
    const n = num(b[k]);
    if (Number.isNaN(n) || (n != null && (n < 0 || !Number.isInteger(n)))) return NextResponse.json({ error: `${k.replaceAll("_", " ")} must be a whole number` }, { status: 400 });
    row[k] = n;
  }
  for (const k of PCTS) {
    const n = num(b[k]);
    if (Number.isNaN(n) || (n != null && (n < 0 || n > 100))) return NextResponse.json({ error: `${k.replaceAll("_", " ")} must be 0 to 100` }, { status: 400 });
    row[k] = n;
  }
  const year = num(b.year_built);
  row.year_built = year != null && !Number.isNaN(year) && year > 1900 && year < 2100 ? Math.round(year) : null;
  row.age_restricted = b.age_restricted === "55plus" ? true : b.age_restricted === "all" ? false : null;
  row.land_tenure = b.land_tenure === "owned" || b.land_tenure === "leased" ? b.land_tenure : null;
  row.owned_since = isoDate(b.owned_since);
  row.amenities = typeof b.amenities === "string" && b.amenities.trim() ? b.amenities.trim() : null;
  row.notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null;

  const filled = Object.entries(row).some(
    ([k, v]) => v != null && !["park_id", "source", "observed_on", "entered_by", "entered_by_name"].includes(k),
  );
  if (!filled) return NextResponse.json({ error: "Enter at least one figure" }, { status: 400 });
  const total = row.total_sites as number | null;
  if (total != null && ((row.vacant_sites as number | null) ?? 0) + ((row.dev_sites as number | null) ?? 0) > total)
    return NextResponse.json({ error: "Vacant plus under-development sites exceed total sites" }, { status: 400 });

  const { error } = await supabase.from("park_operating").insert(row);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
