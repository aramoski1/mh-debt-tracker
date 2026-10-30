import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { money, monthYear } from "@/lib/format";
import { PageHeader } from "@/components/ui/Bits";
import { forecast } from "@/lib/forecast";
import { BOARD, STAGE_LABEL, boardColumn } from "@/lib/stages";
import { Board } from "./Board";
import BuyBoxForm from "./BuyBoxForm";

export const dynamic = "force-dynamic";

type Deal = {
  park_id: string; stage: string; next_action: string | null; note: string | null;
  price?: number | null; close_date?: string | null; diligence_date?: string | null; stage_changed_at?: string | null;
};
type Park = {
  id: string; name: string; city: string | null; units?: number | null; score: number | null; maturity_date: string | null;
  owner_name: string | null; current_balance: number | null; original_amount: number | null;
};
type Box = { min_sites: number; max_sites: number; states: string[]; kinds: string[] };

export default async function PipelinePage() {
  const supabase = await supabaseServer();
  const [{ data: deals }, { data: box }] = await Promise.all([
    supabase.from("deals").select("*"),
    supabase.from("buy_box").select("*").eq("id", 1).maybeSingle(),
  ]);
  const list = (deals ?? []) as Deal[];
  const ids = list.map((d) => d.park_id);
  const { data: parks } = ids.length
    ? await supabase.from("park_overview").select("id, name, city, units, score, maturity_date, owner_name, current_balance, original_amount").in("id", ids)
    : { data: [] };
  const byId = new Map(((parks ?? []) as Park[]).map((p) => [p.id, p]));
  const today = new Date().toISOString().slice(0, 10);
  const calls = list.filter((d) => d.next_action && d.next_action <= today && d.stage !== "passed" && d.stage !== "closed");
  const outlook = forecast(list.map((deal) => ({
    stage: deal.stage,
    price: deal.price ?? null,
    sites: byId.get(deal.park_id)?.units ?? null,
    close_date: deal.close_date ?? null,
  })));
  const stale = list.filter((deal) => {
    if (!deal.stage_changed_at || deal.stage === "closed" || deal.stage === "passed") return false;
    return Date.now() - new Date(deal.stage_changed_at).getTime() > 14 * 86_400_000;
  });

  return (
    <div className="space-y-4">
      <PageHeader kicker="Pipeline" title="Deals in motion" lede={`Probability-weighted price ${outlook.weighted ? money(outlook.weighted) : "—"}. ${outlook.won} won of ${outlook.decided} decided. ${stale.length} sitting more than 14 days.`} />
      <Board columns={BOARD.map((key) => ({
        id: key,
        label: `${STAGE_LABEL[key] ?? key}${(() => {
          const cards = list.filter((deal) => boardColumn(deal.stage) === key);
          const debt = cards.reduce((sum, deal) => {
            const park = byId.get(deal.park_id);
            return sum + Number(park?.current_balance ?? park?.original_amount ?? 0);
          }, 0);
          return debt ? ` · ${money(debt)}` : "";
        })()}`,
        cards: list.filter((deal) => boardColumn(deal.stage) === key).map((deal) => ({
          parkId: deal.park_id,
          name: byId.get(deal.park_id)?.name ?? "Park",
          overdue: deal.next_action && deal.next_action < today && deal.stage !== "closed" && deal.stage !== "passed" ? deal.next_action : null,
          stale: Boolean(deal.stage_changed_at) && Date.now() - new Date(deal.stage_changed_at as string).getTime() > 14 * 86_400_000,
        })),
      }))} />
      <section className="rounded-sm border border-line bg-panel p-4">
        <h2 className="mb-2 font-semibold">Call today</h2>
        {calls.length === 0 && <p className="text-muted">Nothing is due. Set a next action on a park.</p>}
        <ul className="space-y-2">
          {calls.map((d) => (
            <li key={d.park_id}>
              <Link href={`/parks/${d.park_id}`} className="font-medium hover:text-accent">{byId.get(d.park_id)?.name ?? "Park"}</Link>
              <span className="text-muted"> · {d.next_action} · {STAGE_LABEL[d.stage] ?? d.stage}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="overflow-x-auto rounded-sm border border-line bg-panel">
        <table className="w-full">
          <thead className="bg-sunken text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Park</th>
              <th className="px-4 py-2 font-medium">Stage</th>
              <th className="px-4 py-2 font-medium">Next</th>
              <th className="px-4 py-2 text-right font-medium">Pressure</th>
              <th className="px-4 py-2 font-medium">Matures</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => {
              const p = byId.get(d.park_id);
              return (
                <tr key={d.park_id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <Link href={`/parks/${d.park_id}`} className="font-medium hover:text-accent">{p?.name ?? d.park_id}</Link>
                    <div className="text-xs text-muted">{p?.city}{p?.owner_name ? ` · ${p.owner_name}` : ""}</div>
                  </td>
                  <td className="px-4 py-2">{STAGE_LABEL[d.stage] ?? d.stage}</td>
                  <td className="num px-4 py-2">{d.next_action ?? "—"}</td>
                  <td className="num px-4 py-2 text-right">{p?.score == null ? "—" : Math.round(p.score)}</td>
                  <td className="num px-4 py-2">{monthYear(p?.maturity_date ?? null)}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={5} className="px-4 py-6 text-muted">No parks in the pipeline. Set a stage on a park page.</td></tr>}
          </tbody>
        </table>
      </section>
      <BuyBoxForm box={(box ?? null) as Box | null} />
    </div>
  );
}
