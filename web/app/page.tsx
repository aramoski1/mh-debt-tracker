import { supabaseServer } from "@/lib/supabase/server";
import type { ParkRow } from "@/lib/types";
import Filters from "./Filters";
import Prospects from "./Prospects";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

const LENDER_GROUPS: Record<string, string[]> = {
  bank: ["community_bank", "regional_bank", "national_bank", "credit_union"],
  agency: ["agency_fannie", "agency_freddie", "agency_lender"],
  cmbs: ["cmbs_trust", "conduit_lender"],
  private: ["individual", "debt_fund"],
};

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();

  let q = supabase.from("park_overview").select("*").order("score", { ascending: false, nullsFirst: false }).limit(2000);
  q = q.eq("state", sp.state || "AZ");
  if (sp.kind) q = q.eq("kind", sp.kind);
  if (sp.minUnits) q = q.gte("units", Number(sp.minUnits));
  if (sp.maxUnits) q = q.lte("units", Number(sp.maxUnits));
  if (sp.minScore) q = q.gte("score", Number(sp.minScore));
  if (sp.lender && LENDER_GROUPS[sp.lender]) q = q.in("lender_kind", LENDER_GROUPS[sp.lender]);
  if (sp.lender === "none") q = q.is("loan_id", null);
  if (sp.basis === "known") q = q.in("maturity_basis", ["reported", "document"]);
  if (sp.window) {
    const end = new Date();
    end.setMonth(end.getMonth() + Number(sp.window));
    q = q.lte("maturity_date", end.toISOString().slice(0, 10));
  }
  const term = (sp.q ?? "").replace(/[,()%*]/g, " ").trim();
  if (term) q = q.or(`name.ilike.%${term}%,owner_name.ilike.%${term}%,city.ilike.%${term}%`);

  const { data, error } = await q;
  const rows = (data ?? []) as ParkRow[];

  return (
    <div className="space-y-3">
      <Filters current={sp} />
      {error && <p className="rounded border border-red-200 bg-red-50 p-3 text-red-800">{error.message}</p>}
      <Prospects rows={rows} />
    </div>
  );
}
