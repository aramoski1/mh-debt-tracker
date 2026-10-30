import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = { park_id: string };
type Park = { id: string; name: string; city: string | null; units: number | null; flood_zone: string | null };

export default async function PortfolioPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("portfolio").select("park_id");
  const ids = ((data ?? []) as Row[]).map((r) => r.park_id);
  const { data: parks } = ids.length
    ? await supabase.from("park_overview").select("id, name, city, units, flood_zone").in("id", ids)
    : { data: [] };
  const rows = (parks ?? []) as Park[];
  const sites = rows.reduce((s, p) => s + (p.units ?? 0), 0);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-2xs font-medium tracking-wide text-accent">PORTFOLIO</p>
        <h1 className="text-2xl font-medium">Parks you manage</h1>
        <p className="mt-1 text-body">{rows.length} parks · {sites.toLocaleString()} sites on record</p>
      </header>
      <ul className="divide-y divide-line rounded-sm border border-line bg-panel">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <Link href={`/parks/${p.id}`} className="font-medium hover:text-accent">{p.name}</Link>
              <div className="text-xs text-muted">{p.city ?? ""}{p.units ? ` · ${p.units} sites` : ""}</div>
            </div>
            <span className="text-xs text-muted">Flood {p.flood_zone ?? "—"}</span>
          </li>
        ))}
        {!rows.length && <li className="px-4 py-6 text-muted">None marked. Use Mark managed on a park page. Distance in the fit score stays at zero until you do.</li>}
      </ul>
    </div>
  );
}
