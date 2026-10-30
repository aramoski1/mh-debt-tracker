import { callLine, callTargets } from "@/lib/brief";
import { RANK, rankToday, type TodayItem } from "@/lib/today";
import { money, monthsFromNow } from "@/lib/format";
import { applyProspectFilters } from "@/lib/prospects";
import { BOARD, STAGE_LABEL, boardColumn } from "@/lib/stages";
import { supabaseServer } from "@/lib/supabase/server";
import type { ParkRow } from "@/lib/types";
import { DeskView } from "./DeskView";
import type { FollowUp } from "../FollowUps";

export const dynamic = "force-dynamic";

function contacted(iso: string | null | undefined) {
  if (!iso) return "Never logged";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days) || days < 0) return "Never logged";
  if (days === 0) return "Logged today";
  if (days === 1) return "Logged yesterday";
  return `Logged ${days} days ago`;
}

export default async function DeskPage() {
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  const week = horizon.toISOString().slice(0, 10);

  const [{ data }, { data: dealRows }, { data: noteRows }] = await Promise.all([
    applyProspectFilters(
      supabase.from("park_overview").select("*").order("score", { ascending: false, nullsFirst: false }).limit(2000),
      {},
    ),
    supabase.from("deals").select("park_id, stage, next_action"),
    supabase.from("activities").select("park_id, next_follow_up").limit(500),
  ]);
  const rows = (data ?? []) as ParkRow[];
  const byId = new Map(rows.map((park) => [park.id, park]));

  const followups: FollowUp[] = [];
  for (const deal of (dealRows ?? []) as { park_id: string; stage: string; next_action: string | null }[]) {
    if (!deal.next_action || deal.next_action > week || deal.stage === "closed" || deal.stage === "passed") continue;
    followups.push({
      parkId: deal.park_id,
      name: byId.get(deal.park_id)?.name ?? "Park",
      when: deal.next_action,
      why: STAGE_LABEL[deal.stage] ?? deal.stage,
    });
  }
  for (const note of (noteRows ?? []) as { park_id: string; next_follow_up: string | null }[]) {
    if (!note.next_follow_up || note.next_follow_up > week || followups.some((item) => item.parkId === note.park_id)) continue;
    followups.push({ parkId: note.park_id, name: byId.get(note.park_id)?.name ?? "Park", when: note.next_follow_up, why: "From a note" });
  }
  followups.sort((a, b) => a.when.localeCompare(b.when));

  const ranked: TodayItem[] = [];
  const seen = new Set<string>();
  const push = (item: TodayItem) => {
    if (seen.has(item.href + item.rank)) return;
    seen.add(item.href + item.rank);
    ranked.push(item);
  };
  for (const park of rows) {
    const months = monthsFromNow(park.maturity_date);
    if (park.loan_status === "foreclosure") {
      push({ id: `${park.id}-trustee`, rank: RANK.trustee, title: park.name, why: callLine(park), href: `/parks/${park.id}` });
    } else if ((park.lender_kind === "cmbs_trust" || park.lender_kind === "conduit_lender") && /delinq|special/i.test(park.loan_status ?? "")) {
      push({ id: `${park.id}-servicing`, rank: RANK.servicing, title: park.name, why: callLine(park), href: `/parks/${park.id}` });
    } else if ((park.maturity_basis === "reported" || park.maturity_basis === "document") && months != null && months >= 0 && months <= 6) {
      push({ id: `${park.id}-m6`, rank: RANK.maturity6, title: park.name, why: callLine(park), href: `/parks/${park.id}` });
    } else if (park.maturity_basis === "estimated" && months != null && months >= 0 && months <= 12) {
      push({ id: `${park.id}-m12`, rank: RANK.maturity12, title: park.name, why: callLine(park), href: `/parks/${park.id}` });
    }
  }
  for (const item of followups) {
    push({ id: `${item.parkId}-due`, rank: item.why === "From a note" ? RANK.followup : RANK.deal, title: item.name, why: item.why, href: `/parks/${item.parkId}`, due: item.when });
  }
  const ordered = rankToday(ranked).slice(0, 12);

  const dueYear = rows.filter((park) => {
    const months = monthsFromNow(park.maturity_date);
    return months != null && months >= 0 && months <= 12;
  }).length;
  const documented = rows.filter((park) => park.maturity_basis === "reported" || park.maturity_basis === "document").length;
  const distressAll = rows.filter((park) => park.loan_status === "foreclosure");
  const distress = distressAll.slice(0, 8);
  const debt = rows.reduce((sum, park) => sum + Number(park.current_balance ?? park.original_amount ?? 0), 0);

  const deals = (dealRows ?? []) as { park_id: string; stage: string }[];
  const stages = BOARD.map((id) => {
    const inStage = deals.filter((deal) => boardColumn(deal.stage) === id);
    const balance = inStage.reduce((sum, deal) => {
      const park = byId.get(deal.park_id);
      return sum + Number(park?.current_balance ?? park?.original_amount ?? 0);
    }, 0);
    return { id, label: STAGE_LABEL[id] ?? id, count: inStage.length, debt: balance };
  });

  return (
    <DeskView
      today={today}
      ranked={ordered}
      counts={{ parks: rows.length, dueYear, debt: money(debt), documented, foreclosure: distressAll.length }}
      followups={followups.slice(0, 12)}
      calls={callTargets(rows).map((park) => ({
        id: park.id,
        name: park.name,
        city: park.city,
        line: callLine(park),
        score: park.score,
        matures: park.maturity_date,
        contacted: contacted(park.last_activity_at),
      }))}
      unworked={rows.filter((park) => (park.score ?? 0) >= 50 && !park.last_activity_at).slice(0, 8).map((park) => ({
        id: park.id, name: park.name, city: park.city, score: park.score,
      }))}
      distress={distress.map((park) => ({ id: park.id, name: park.name, city: park.city, score: park.score }))}
      stages={stages}
    />
  );
}
