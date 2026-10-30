import { supabaseServer } from "@/lib/supabase/server";
import { isDemo } from "@/lib/supabase/demo";
import { pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  DGS5: "5-year Treasury",
  DGS7: "7-year Treasury",
  DGS10: "10-year Treasury",
  DPRIME: "Bank prime",
  BAA10Y: "Moody's Baa over the 10-year",
  SOFR: "SOFR",
};

type Print = { series: string; observed_on: string; value: number };
type Spread = { source: string; lender_kind: string; median_spread: number; sample_size: number; as_of: string };

export default async function RatesPage() {
  const supabase = await supabaseServer();
  const [{ data: prints }, { data: spreads }] = await Promise.all([
    supabase.from("rate_prints").select("*").order("observed_on", { ascending: false }).limit(4000),
    supabase.from("market_spreads").select("*").order("as_of", { ascending: false }),
  ]);
  const latest = new Map<string, Print>();
  for (const row of (prints ?? []) as Print[]) if (!latest.has(row.series)) latest.set(row.series, row);
  const seen = new Set<string>();
  const spreadRows = ((spreads ?? []) as Spread[]).filter((r) => {
    const k = `${r.source}:${r.lender_kind}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-medium tracking-[0.22em] text-[#85152a]">RATE DESK</p>
        <h1 className="text-2xl font-medium">What money costs</h1>
        <p className="mt-1 max-w-3xl text-[#333539]">
          Treasury and SOFR prints are the published series. A spread is the median of note rate minus the
          5-year Treasury on the origination date, from CMBS and SBA loans already in the database.
          The model uses a spread only when the sample has at least 8 loans. Agency spreads stay blank until a Fannie or Freddie file is imported.
        </p>
        {isDemo() && <p className="mt-2 text-xs text-[#787d85]">The figures on this page are the fictional demo set.</p>}
      </header>
      <div className="grid gap-px overflow-hidden rounded-sm border border-[#e2e2e2] bg-[#e2e2e2] sm:grid-cols-3">
        {Object.entries(LABELS).map(([series, label]) => {
          const row = latest.get(series);
          return (
            <div key={series} className="bg-white px-4 py-3">
              <p className="text-[10px] font-medium tracking-[0.16em] text-[#787d85]">{label.toUpperCase()}</p>
              <p className="num mt-1 text-2xl">{row ? pct(Number(row.value)) : "—"}</p>
              <p className="text-xs text-[#787d85]">{row ? row.observed_on : "No print loaded"}</p>
            </div>
          );
        })}
      </div>
      <section className="overflow-x-auto rounded-sm border border-[#e2e2e2] bg-white">
        <h2 className="border-b border-[#e2e2e2] px-4 py-3 font-semibold">Measured spreads</h2>
        <table className="w-full">
          <thead className="bg-[#f7f7f8] text-left text-xs text-[#787d85]">
            <tr>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Lender type</th>
              <th className="px-4 py-2 text-right font-medium">Median over the 5-year</th>
              <th className="px-4 py-2 text-right font-medium">Loans</th>
              <th className="px-4 py-2 font-medium">As of</th>
              <th className="px-4 py-2 font-medium">In the model</th>
            </tr>
          </thead>
          <tbody>
            {spreadRows.map((r) => (
              <tr key={`${r.source}-${r.lender_kind}`} className="border-t border-[#f4f4f4]">
                <td className="px-4 py-2 uppercase">{r.source}</td>
                <td className="px-4 py-2">{r.lender_kind.replaceAll("_", " ")}</td>
                <td className="num px-4 py-2 text-right">{Number(r.median_spread).toFixed(2)} pts</td>
                <td className="num px-4 py-2 text-right">{r.sample_size}</td>
                <td className="num px-4 py-2">{r.as_of}</td>
                <td className="px-4 py-2">{r.sample_size >= 8 ? "Yes" : "Shown only"}</td>
              </tr>
            ))}
            {!spreadRows.length && (
              <tr><td colSpan={6} className="px-4 py-6 text-[#787d85]">No spreads yet. Run mhdebt rates after loans are loaded.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
