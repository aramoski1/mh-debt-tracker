import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { shownPressure } from "@/lib/brief";
import type { ParkRow } from "@/lib/types";
import { money, monthYear } from "@/lib/format";
import { Metric, MetricStrip } from "@/components/ui/Bits";
import { ScorePill } from "@/components/ui/ScorePill";
import { Contacts } from "./Contacts";

export const dynamic = "force-dynamic";

type Park = {
  id: string; name: string; city: string | null; state: string; units: number | null;
  score: number | null; loan_id: string | null; score_components: ParkRow["score_components"];
  maturity_date: string | null; owner_name: string | null;
  owner_city: string | null; owner_state: string | null; owner_entity_type: string | null;
  current_balance: number | null; original_amount: number | null;
};

export default async function OwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("park_overview").select("*").eq("owner_id", id).order("score", { ascending: false });
  const parks = ((data ?? []) as Park[]).sort((a, b) => (shownPressure(b) ?? -1) - (shownPressure(a) ?? -1));
  if (!parks.length) notFound();
  const o = parks[0];
  const { data: people } = await supabase.from("contacts").select("id, name, role, phone, email, mailing, source, verified").eq("owner_id", id);
  const { data: notes } = await supabase.from("activities").select("id, kind, body, created_at, park_id").in("park_id", parks.map((park) => park.id)).order("created_at", { ascending: false }).limit(12);
  const sites = parks.reduce((sum, park) => sum + (park.units ?? 0), 0);
  const debt = parks.reduce((sum, park) => sum + Number(park.current_balance ?? 0), 0);
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
        <p className="mt-2 text-sm text-body">
          Recorded debt on the book is {debt ? money(debt) : "—"}. Next maturity {monthYear(next)}.
          {" "}<a className="text-accent" href="https://ecorp.azcc.gov/" target="_blank" rel="noreferrer">Look up this entity on the Arizona Corporation Commission</a>, then paste what you find into a note. This desk does not pull that site.
        </p>
      </header>
      <MetricStrip>
        <Metric label="Parks" value={parks.length.toLocaleString()} />
        <Metric label="Sites" value={sites.toLocaleString()} />
        <Metric label="Debt on file" value={money(debt)} />
        <Metric label="Next maturity" value={monthYear(next)} />
      </MetricStrip>
      <Contacts ownerId={id} parkId={parks[0]?.id ?? null} rows={(people ?? []) as { id: string; name: string | null; role: string; phone: string | null; email: string | null; mailing: string | null; source: string; verified: boolean }[]} />
      <section className="rounded-md border border-line bg-panel">
        <h2 className="border-b border-line px-4 py-2 text-sm font-medium">Timeline</h2>
        {((notes ?? []) as { id: string; kind: string; body: string; created_at: string }[]).length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted">No calls or notes on these parks yet. A purchase date shows on each park when the assessor has a sale.</p>
        ) : (
          <ul className="divide-y divide-line">
            {((notes ?? []) as { id: string; kind: string; body: string; created_at: string }[]).map((note) => (
              <li key={note.id} className="px-4 py-2 text-sm"><span className="text-xs text-muted">{note.created_at.slice(0, 10)} · {note.kind}</span><p>{note.body}</p></li>
            ))}
          </ul>
        )}
      </section>
      <ul className="divide-y divide-line rounded-md border border-line bg-panel">
        {parks.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <Link href={`/parks/${p.id}`} className="font-medium hover:text-accent">{p.name}</Link>
              <div className="text-xs text-muted">{p.city}, {p.state}{p.units != null ? ` · ${p.units} sites` : ""} · matures {monthYear(p.maturity_date)}</div>
            </div>
            <ScorePill score={shownPressure(p)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
