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
  SOFR_AVG_30: "30-day average SOFR",
  SOFR_AVG_90: "90-day average SOFR",
  SOFR_AVG_180: "180-day average SOFR",
  TSY_5Y: "Treasury par 5-year",
  TSY_7Y: "Treasury par 7-year",
  TSY_10Y: "Treasury par 10-year",
  DRTSCLCC: "Banks tightening CRE",
  CPI_SHELTER: "Shelter CPI index",
};

type Print = { series: string; observed_on: string; value: number };
type Spread = { source: string; lender_kind: string; median_spread: number; sample_size: number; as_of: string };
type TermSpread = Spread & { tenor: string; quarter: string; method: string };

export default async function RatesPage() {
  const supabase = await supabaseServer();
  const [{ data: prints }, { data: spreads }, { data: termSpreads }] = await Promise.all([
    supabase.from("rate_prints").select("*").order("observed_on", { ascending: false }).limit(8000),
    supabase.from("market_spreads").select("*").order("as_of", { ascending: false }),
    supabase.from("loan_spreads").select("*").order("quarter", { ascending: false }).limit(80),
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
          Treasury, SOFR, the shelter CPI, and the Fed's CRE lending survey are the published series.
          Shelter CPI is an index, not a lot rent. The CRE figure is the net percent of banks tightening standards.
          The rollup spread is the median of note rate minus the 5-year Treasury on the origination date.
          The term table uses the nearest of the 5-, 7-, and 10-year Treasury when the loan has a term, and says so when it does not.
          CMBS and SBA loans already in the database are the sample. Agency rows stay empty until a Fannie or Freddie file is imported.
          The model uses a spread only when that lender type has at least 8 loans.
        </p>
        {isDemo() && <p className="mt-2 text-xs text-[#787d85]">The figures on this page are the fictional demo set.</p>}
      </header>
      <div className="grid gap-px overflow-hidden rounded-sm border border-[#e2e2e2] bg-[#e2e2e2] sm:grid-cols-3">
        {Object.entries(LABELS).map(([series, label]) => {
          const row = latest.get(series);
          return (
            <div key={series} className="bg-white px-4 py-3">
              <p className="text-[10px] font-medium tracking-[0.16em] text-[#787d85]">{label.toUpperCase()}</p>
              <p className="num mt-1 text-2xl">{row ? (series === "CPI_SHELTER" ? Number(row.value).toFixed(1) : pct(Number(row.value))) : "—"}</p>
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
      <section className="overflow-x-auto rounded-sm border border-[#e2e2e2] bg-white">
        <h2 className="border-b border-[#e2e2e2] px-4 py-3 font-semibold">Spreads by term and quarter</h2>
        <table className="w-full">
          <thead className="bg-[#f7f7f8] text-left text-xs text-[#787d85]">
            <tr>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Lender type</th>
              <th className="px-4 py-2 font-medium">Treasury</th>
              <th className="px-4 py-2 font-medium">Quarter</th>
              <th className="px-4 py-2 text-right font-medium">Median</th>
              <th className="px-4 py-2 text-right font-medium">Loans</th>
              <th className="px-4 py-2 font-medium">Method</th>
            </tr>
          </thead>
          <tbody>
            {((termSpreads ?? []) as TermSpread[]).map((r) => (
              <tr key={`${r.source}-${r.lender_kind}-${r.tenor}-${r.quarter}-${r.method}`} className="border-t border-[#f4f4f4]">
                <td className="px-4 py-2 uppercase">{r.source}</td>
                <td className="px-4 py-2">{r.lender_kind.replaceAll("_", " ")}</td>
                <td className="px-4 py-2">{r.tenor}</td>
                <td className="num px-4 py-2">{r.quarter}</td>
                <td className="num px-4 py-2 text-right">{Number(r.median_spread).toFixed(2)} pts</td>
                <td className="num px-4 py-2 text-right">{r.sample_size}</td>
                <td className="px-4 py-2">{r.method === "matching_tenor" ? "Matching term" : "No term, used 5-year"}</td>
              </tr>
            ))}
            {!termSpreads?.length && (
              <tr><td colSpan={7} className="px-4 py-6 text-[#787d85]">No term splits yet. Run mhdebt rates.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
