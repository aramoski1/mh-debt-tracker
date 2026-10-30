import Link from "next/link";
import { PageHeader } from "@/components/ui/Bits";
import { STAGE_LABEL } from "@/lib/stages";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Item = { parkId: string; name: string; when: string; why: string };

export default async function FollowUpsPage() {
  const supabase = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: deals }, { data: notes }, { data: parks }] = await Promise.all([
    supabase.from("deals").select("park_id, stage, next_action"),
    supabase.from("activities").select("park_id, next_follow_up").limit(500),
    supabase.from("park_overview").select("id, name").eq("state", "AZ").limit(2000),
  ]);
  const names = new Map(((parks ?? []) as { id: string; name: string }[]).map((park) => [park.id, park.name]));
  const items: Item[] = [];
  for (const deal of (deals ?? []) as { park_id: string; stage: string; next_action: string | null }[]) {
    if (!deal.next_action || deal.stage === "closed" || deal.stage === "passed") continue;
    items.push({ parkId: deal.park_id, name: names.get(deal.park_id) ?? "Park", when: deal.next_action, why: STAGE_LABEL[deal.stage] ?? deal.stage });
  }
  for (const note of (notes ?? []) as { park_id: string; next_follow_up: string | null }[]) {
    if (!note.next_follow_up || items.some((item) => item.parkId === note.park_id)) continue;
    items.push({ parkId: note.park_id, name: names.get(note.park_id) ?? "Park", when: note.next_follow_up, why: "From a note" });
  }
  items.sort((a, b) => a.when.localeCompare(b.when));
  const buckets = {
    Overdue: items.filter((item) => item.when < today),
    Today: items.filter((item) => item.when === today),
    Upcoming: items.filter((item) => item.when > today),
  };
  return (
    <div className="space-y-4">
      <PageHeader kicker="Work" title="Follow-ups" lede="Next actions on deals, then dates pulled from notes. Nothing here has been marked done." />
      {Object.entries(buckets).map(([label, rows]) => (
        <section key={label} className="rounded-md border border-line bg-panel">
          <h2 className="border-b border-line px-4 py-2 text-sm font-medium">{label} · {rows.length}</h2>
          {rows.length === 0 ? <p className="px-4 py-3 text-sm text-muted">Nothing in this bucket.</p> : (
            <ul className="divide-y divide-line">
              {rows.map((row) => (
                <li key={`${label}-${row.parkId}-${row.when}`} className="flex justify-between gap-2 px-4 py-2 text-sm">
                  <Link href={`/parks/${row.parkId}`} className="font-medium hover:text-accent">{row.name}</Link>
                  <span className="text-xs text-muted"><span className="num">{row.when}</span> · {row.why}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
