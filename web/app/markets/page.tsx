import { supabaseServer } from "@/lib/supabase/server";
import { monthsFromNow } from "@/lib/format";
import { PageHeader } from "@/components/ui/Bits";
import type { ParkRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("park_overview").select("county, score, maturity_date, units").eq("state", "AZ").limit(2000);
  const rows = (data ?? []) as Pick<ParkRow, "county" | "score" | "maturity_date" | "units">[];
  const byCounty = new Map<string, { parks: number; sites: number; due: number; score: number; scored: number }>();
  for (const row of rows) {
    const key = row.county || "Unknown";
    const cell = byCounty.get(key) ?? { parks: 0, sites: 0, due: 0, score: 0, scored: 0 };
    cell.parks += 1;
    cell.sites += row.units ?? 0;
    const months = monthsFromNow(row.maturity_date);
    if (months != null && months >= 0 && months <= 12) cell.due += 1;
    if (row.score != null) {
      cell.score += Number(row.score);
      cell.scored += 1;
    }
    byCounty.set(key, cell);
  }
  const counties = [...byCounty.entries()].sort((a, b) => b[1].parks - a[1].parks);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Markets" title="Arizona counties" lede="Counts come from the parks already on the desk. This is not a rent or population series." />
      <section className="overflow-x-auto rounded-md border border-line bg-panel">
        <table className="w-full">
          <thead className="bg-sunken text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">County</th>
              <th className="px-4 py-2 text-right font-medium">Parks</th>
              <th className="px-4 py-2 text-right font-medium">Sites</th>
              <th className="px-4 py-2 text-right font-medium">Due in 12 months</th>
              <th className="px-4 py-2 text-right font-medium">Average score</th>
            </tr>
          </thead>
          <tbody>
            {counties.map(([name, cell]) => (
              <tr key={name} className="border-t border-line">
                <td className="px-4 py-2">{name}</td>
                <td className="num px-4 py-2 text-right">{cell.parks.toLocaleString()}</td>
                <td className="num px-4 py-2 text-right">{cell.sites.toLocaleString()}</td>
                <td className="num px-4 py-2 text-right">{cell.due.toLocaleString()}</td>
                <td className="num px-4 py-2 text-right">{cell.scored ? Math.round(cell.score / cell.scored) : "—"}</td>
              </tr>
            ))}
            {!counties.length && <tr><td colSpan={5} className="px-4 py-6 text-muted">No parks loaded.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
