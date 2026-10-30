import { supabaseServer } from "@/lib/supabase/server";
import { monthsFromNow, money } from "@/lib/format";
import type { ParkRow } from "@/lib/types";
import Filters from "./Filters";
import Prospects from "./Prospects";
import CallList from "./CallList";
import { Metric, MetricStrip } from "@/components/ui/Bits";

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

  const dueYear = rows.filter((r) => {
    const m = monthsFromNow(r.maturity_date);
    return m != null && m >= 0 && m <= 12;
  }).length;
  const documented = rows.filter((r) => r.maturity_basis === "reported" || r.maturity_basis === "document").length;
  const foreclosure = rows.filter((r) => r.loan_status === "foreclosure").length;
  const debt = rows.reduce((sum, r) => sum + Number(r.current_balance ?? r.original_amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <MetricStrip>
        <Metric label="Parks in view" value={rows.length.toLocaleString()} />
        <Metric label="Due within 12 months" value={dueYear.toLocaleString()} />
        <Metric label="Balance in view" value={money(debt)} />
        <Metric label="Date from a document" value={documented.toLocaleString()} detail={foreclosure ? `${foreclosure} foreclosure notices` : undefined} />
      </MetricStrip>
      <div id="calls" className="relative z-10 scroll-mt-20">
        <CallList rows={rows} />
      </div>
      <nav aria-label="Saved views" className="flex gap-2 overflow-x-auto text-sm">
        {[
          ["All Arizona", "/"],
          ["50–200 sites · bank · 18 mo", "/?minUnits=50&maxUnits=200&lender=bank&window=18"],
          ["Due in 12 months", "/?window=12"],
          ["Known dates", "/?basis=known"],
        ].map(([label, href]) => (
          <a key={label} href={href} className="shrink-0 rounded-sm border border-line bg-panel px-2 py-1 hover:bg-sunken">{label}</a>
        ))}
      </nav>
      <Filters current={sp} />
      {error && <p className="rounded-sm border border-line bg-negative-soft p-3 text-accent">{error.message}</p>}
      <Prospects rows={rows} />
    </div>
  );
}
