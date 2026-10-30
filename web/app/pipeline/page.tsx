import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { monthYear } from "@/lib/format";
import BuyBoxForm from "./BuyBoxForm";

export const dynamic = "force-dynamic";

const STAGE: Record<string, string> = {
  target: "Target", contacted: "Contacted", loi: "LOI",
  under_contract: "Under contract", closed: "Closed", passed: "Passed",
};

type Deal = { park_id: string; stage: string; next_action: string | null; note: string | null };
type Park = { id: string; name: string; city: string | null; score: number | null; maturity_date: string | null; owner_name: string | null };
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
    ? await supabase.from("park_overview").select("id, name, city, score, maturity_date, owner_name").in("id", ids)
    : { data: [] };
  const byId = new Map(((parks ?? []) as Park[]).map((p) => [p.id, p]));
  const today = new Date().toISOString().slice(0, 10);
  const calls = list.filter((d) => d.next_action && d.next_action <= today && d.stage !== "passed" && d.stage !== "closed");

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-medium tracking-[0.22em] text-[#85152a]">PIPELINE</p>
        <h1 className="text-2xl font-medium">Deals in motion</h1>
      </header>
      <section className="rounded-sm border border-[#e2e2e2] bg-white p-4">
        <h2 className="mb-2 font-semibold">Call today</h2>
        {calls.length === 0 && <p className="text-[#787d85]">Nothing is due. Set a next action on a park.</p>}
        <ul className="space-y-2">
          {calls.map((d) => (
            <li key={d.park_id}>
              <Link href={`/parks/${d.park_id}`} className="font-medium hover:text-[#85152a]">{byId.get(d.park_id)?.name ?? "Park"}</Link>
              <span className="text-[#787d85]"> · {d.next_action} · {STAGE[d.stage]}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="overflow-x-auto rounded-sm border border-[#e2e2e2] bg-white">
        <table className="w-full">
          <thead className="bg-[#f7f7f8] text-left text-xs text-[#787d85]">
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
                <tr key={d.park_id} className="border-t border-[#f4f4f4]">
                  <td className="px-4 py-2">
                    <Link href={`/parks/${d.park_id}`} className="font-medium hover:text-[#85152a]">{p?.name ?? d.park_id}</Link>
                    <div className="text-xs text-[#787d85]">{p?.city}{p?.owner_name ? ` · ${p.owner_name}` : ""}</div>
                  </td>
                  <td className="px-4 py-2">{STAGE[d.stage] ?? d.stage}</td>
                  <td className="num px-4 py-2">{d.next_action ?? "—"}</td>
                  <td className="num px-4 py-2 text-right">{p?.score == null ? "—" : Math.round(p.score)}</td>
                  <td className="num px-4 py-2">{monthYear(p?.maturity_date ?? null)}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={5} className="px-4 py-6 text-[#787d85]">No parks in the pipeline. Set a stage on a park page.</td></tr>}
          </tbody>
        </table>
      </section>
      <BuyBoxForm box={(box ?? null) as Box | null} />
    </div>
  );
}
