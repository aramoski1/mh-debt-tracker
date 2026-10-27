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
    <section className="rounded border border-stone-200 bg-white">
      <h1 className="border-b border-stone-200 px-4 py-3 font-semibold">Alerts</h1>
      <ul>
        {(data ?? []).map((a) => (
          <li key={a.id} className="flex gap-4 border-t border-stone-100 px-4 py-3 first:border-t-0">
            <span className="w-24 shrink-0 text-xs uppercase tracking-wide text-stone-500">{KIND[a.kind] ?? a.kind}</span>
            <div className="flex-1">
              {a.park_id ? <Link href={`/parks/${a.park_id}`} className="font-medium hover:underline">{a.title}</Link> : a.title}
              {a.detail && <p className="text-xs text-stone-500">{a.detail}</p>}
            </div>
            <span className="num text-xs text-stone-500">{new Date(a.created_at).toLocaleDateString()}</span>
          </li>
        ))}
        {!data?.length && <li className="px-4 py-8 text-center text-stone-500">Nothing new.</li>}
      </ul>
    </section>
  );
}
