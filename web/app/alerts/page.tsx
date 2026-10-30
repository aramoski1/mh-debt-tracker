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
    <section className="overflow-hidden rounded-sm border border-line bg-panel">
      <div className="border-b border-gold bg-inverse px-4 py-3 text-on-inverse">
        <p className="text-2xs font-medium tracking-wide text-gold">Alerts</p>
        <h1 className="text-lg font-medium">Alerts</h1>
      </div>
      <ul>
        {(data ?? []).map((a) => (
          <li key={a.id} className="flex gap-4 border-t border-line px-4 py-3 first:border-t-0">
            <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-accent">{KIND[a.kind] ?? a.kind}</span>
            <div className="flex-1">
              {a.park_id ? <Link href={`/parks/${a.park_id}`} className="font-medium hover:text-accent">{a.title}</Link> : a.title}
              {a.detail && <p className="text-xs text-muted">{a.detail}</p>}
            </div>
            <span className="num text-xs text-muted">{new Date(a.created_at).toLocaleDateString()}</span>
          </li>
        ))}
        {!data?.length && <li className="px-4 py-8 text-center text-muted">Nothing new since the last scoring run.</li>}
      </ul>
    </section>
  );
}
