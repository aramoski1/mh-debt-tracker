import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { monthYear, scoreTone } from "@/lib/format";

export const dynamic = "force-dynamic";

type Park = {
  id: string; name: string; city: string | null; state: string; units: number | null;
  score: number | null; maturity_date: string | null; owner_name: string | null;
  owner_city: string | null; owner_state: string | null; owner_entity_type: string | null;
};

export default async function OwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("park_overview").select("*").eq("owner_id", id).order("score", { ascending: false });
  const parks = (data ?? []) as Park[];
  if (!parks.length) notFound();
  const o = parks[0];
  return (
    <div className="space-y-4">
      <Link href="/" className="text-xs text-muted hover:text-accent">← Prospects</Link>
      <header className="rounded-sm border border-line bg-panel p-5">
        <p className="text-2xs font-medium tracking-wide text-accent">OWNER</p>
        <h1 className="text-2xl font-medium">{o.owner_name}</h1>
        <p className="text-body">
          {[o.owner_city, o.owner_state].filter(Boolean).join(", ")}
          {o.owner_entity_type ? ` · ${o.owner_entity_type}` : ""} · {parks.length} park{parks.length === 1 ? "" : "s"} in this desk
        </p>
      </header>
      <ul className="divide-y divide-line rounded-sm border border-line bg-panel">
        {parks.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link href={`/parks/${p.id}`} className="font-medium hover:text-accent">{p.name}</Link>
              <div className="text-xs text-muted">{p.city}, {p.state}{p.units ? ` · ${p.units} sites` : ""} · matures {monthYear(p.maturity_date)}</div>
            </div>
            <span className={`num rounded-sm px-2 py-0.5 font-semibold ${scoreTone(p.score)}`}>{p.score == null ? "–" : Math.round(p.score)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
