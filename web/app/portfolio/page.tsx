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
        <p className="text-[10px] font-medium tracking-[0.22em] text-[#85152a]">PORTFOLIO</p>
        <h1 className="text-2xl font-medium">Parks you manage</h1>
        <p className="mt-1 text-[#333539]">{rows.length} parks · {sites.toLocaleString()} sites on record</p>
      </header>
      <ul className="divide-y divide-[#e2e2e2] rounded-sm border border-[#e2e2e2] bg-white">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <Link href={`/parks/${p.id}`} className="font-medium hover:text-[#85152a]">{p.name}</Link>
              <div className="text-xs text-[#787d85]">{p.city ?? ""}{p.units ? ` · ${p.units} sites` : ""}</div>
            </div>
            <span className="text-xs text-[#787d85]">Flood {p.flood_zone ?? "—"}</span>
          </li>
        ))}
        {!rows.length && <li className="px-4 py-6 text-[#787d85]">None marked. Use Mark managed on a park page. Distance in the fit score stays at zero until you do.</li>}
      </ul>
    </div>
  );
}
