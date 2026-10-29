import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = {
  distress: "Distress",
  new_loan: "New loan",
  maturity_window: "Maturing",
  score_jump: "Score jump",
  release: "Payoff",
};

export default async function Alerts() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("alerts").select("*, parks(name, city)").order("created_at", { ascending: false }).limit(300);
  return (
    <section className="overflow-hidden rounded-sm border border-[#e2e2e2] bg-white">
      <div className="border-b border-[#dd9933] bg-[#18191b] px-4 py-3 text-white">
        <p className="text-[10px] font-medium tracking-[0.22em] text-[#dd9933]">SIGNALS</p>
        <h1 className="text-lg font-medium">Alerts</h1>
      </div>
      <ul>
        {(data ?? []).map((a) => (
          <li key={a.id} className="flex gap-4 border-t border-[#f4f4f4] px-4 py-3 first:border-t-0">
            <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-[#85152a]">{KIND[a.kind] ?? a.kind}</span>
            <div className="flex-1">
              {a.park_id ? <Link href={`/parks/${a.park_id}`} className="font-medium hover:text-[#85152a]">{a.title}</Link> : a.title}
              {a.detail && <p className="text-xs text-[#787d85]">{a.detail}</p>}
            </div>
            <span className="num text-xs text-[#787d85]">{new Date(a.created_at).toLocaleDateString()}</span>
          </li>
        ))}
        {!data?.length && <li className="px-4 py-8 text-center text-[#787d85]">Nothing new since the last scoring run.</li>}
      </ul>
    </section>
  );
}
