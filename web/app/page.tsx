import { supabaseServer } from "@/lib/supabase/server";
import { monthsFromNow, money } from "@/lib/format";
import type { ParkRow } from "@/lib/types";
import Filters from "./Filters";
import Prospects from "./Prospects";
import CallList from "./CallList";
import FollowUps, { type FollowUp } from "./FollowUps";
import { AskDesk } from "@/components/ui/AskDesk";
import { Metric, MetricStrip } from "@/components/ui/Bits";
import { applyProspectFilters, narrowProspects } from "@/lib/prospects";
import { STAGE_LABEL } from "@/lib/stages";
import { SavedViews } from "./SavedViews";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const supabase = await supabaseServer();

  const q = applyProspectFilters(
    supabase.from("park_overview").select("*").order("score", { ascending: false, nullsFirst: false }).limit(2000),
    sp,
  );

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  const week = horizon.toISOString().slice(0, 10);
  const [{ data, error }, { data: dealRows }, { data: noteRows }] = await Promise.all([
    q,
    supabase.from("deals").select("park_id, stage, next_action"),
    supabase.from("activities").select("park_id, next_follow_up").limit(500),
  ]);
  const rows = narrowProspects((data ?? []) as ParkRow[], sp);
  const due: FollowUp[] = [];
  for (const deal of (dealRows ?? []) as { park_id: string; stage: string; next_action: string | null }[]) {
    if (!deal.next_action || deal.next_action > week || deal.stage === "closed" || deal.stage === "passed") continue;
    due.push({ parkId: deal.park_id, name: "Park", when: deal.next_action, why: STAGE_LABEL[deal.stage] ?? deal.stage });
  }
  for (const note of (noteRows ?? []) as { park_id: string; next_follow_up: string | null }[]) {
    if (!note.next_follow_up || note.next_follow_up > week || due.some((item) => item.parkId === note.park_id)) continue;
    due.push({ parkId: note.park_id, name: "Park", when: note.next_follow_up, why: "From a note" });
  }
  due.sort((a, b) => a.when.localeCompare(b.when));
  const dueIds = [...new Set(due.map((item) => item.parkId))];
  const { data: named } = dueIds.length
    ? await supabase.from("park_overview").select("id, name").in("id", dueIds)
    : { data: [] as { id: string; name: string }[] };
  const names = new Map(((named ?? []) as { id: string; name: string }[]).map((park) => [park.id, park.name]));
  for (const item of due) item.name = names.get(item.parkId) ?? "Park";

  const dueYear = rows.filter((r) => {
    const m = monthsFromNow(r.maturity_date);
    return m != null && m >= 0 && m <= 12;
  }).length;
  const documented = rows.filter((r) => r.maturity_basis === "reported" || r.maturity_basis === "document").length;
  const foreclosure = rows.filter((r) => r.loan_status === "foreclosure").length;
  const debt = rows.reduce((sum, r) => sum + Number(r.current_balance ?? 0), 0);

  return (
    <div className="space-y-4">
      <MetricStrip>
        <Metric label="Parks in view" value={rows.length.toLocaleString()} />
        <Metric label="Due within 12 months" value={dueYear.toLocaleString()} />
        <Metric label="Balance in view" value={money(debt)} />
        <Metric label="Date from a document" value={documented.toLocaleString()} detail={foreclosure ? `${foreclosure} foreclosure notices` : undefined} />
      </MetricStrip>
      <AskDesk />
      <FollowUps rows={due.slice(0, 12)} today={today} />
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
      <SavedViews current={sp} />
      <Filters current={sp} />
      {error && <p className="rounded-sm border border-line bg-negative-soft p-3 text-accent">{error.message}</p>}
      <Prospects rows={rows} />
    </div>
  );
}
