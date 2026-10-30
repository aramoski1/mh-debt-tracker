import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { money, monthYear } from "@/lib/format";
import { Metric, MetricStrip } from "@/components/ui/Bits";
import { ScorePill } from "@/components/ui/ScorePill";

export const dynamic = "force-dynamic";

type Park = {
  id: string; name: string; city: string | null; state: string; units: number | null;
  score: number | null; maturity_date: string | null; owner_name: string | null;
  owner_city: string | null; owner_state: string | null; owner_entity_type: string | null;
  current_balance: number | null; original_amount: number | null;
};

export default async function OwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("park_overview").select("*").eq("owner_id", id).order("score", { ascending: false });
  const parks = (data ?? []) as Park[];
  if (!parks.length) notFound();
  const o = parks[0];
  const sites = parks.reduce((sum, park) => sum + (park.units ?? 0), 0);
  const debt = parks.reduce((sum, park) => sum + Number(park.current_balance ?? park.original_amount ?? 0), 0);
  const next = parks.map((park) => park.maturity_date).filter(Boolean).sort()[0] ?? null;
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
      <MetricStrip>
        <Metric label="Parks" value={parks.length.toLocaleString()} />
        <Metric label="Sites" value={sites.toLocaleString()} />
        <Metric label="Debt on file" value={money(debt)} />
        <Metric label="Next maturity" value={monthYear(next)} />
      </MetricStrip>
      <ul className="divide-y divide-line rounded-md border border-line bg-panel">
        {parks.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link href={`/parks/${p.id}`} className="font-medium hover:text-accent">{p.name}</Link>
              <div className="text-xs text-muted">{p.city}, {p.state}{p.units ? ` · ${p.units} sites` : ""} · matures {monthYear(p.maturity_date)}</div>
            </div>
            <ScorePill score={p.score} />
          </li>
        ))}
      </ul>
    </div>
  );
}
