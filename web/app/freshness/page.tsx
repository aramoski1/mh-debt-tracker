import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Run = {
  id: number; source: string; status: string; started_at: string;
  finished_at: string | null; stats: Record<string, unknown> | null; error: string | null;
};

export default async function FreshnessPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("source_runs").select("*").order("started_at", { ascending: false }).limit(40);
  const runs = (data ?? []) as Run[];
  return (
    <div className="space-y-4">
      <header>
        <p className="text-[10px] font-medium tracking-[0.22em] text-[#85152a]">FRESHNESS</p>
        <h1 className="text-2xl font-medium">When each source last ran</h1>
      </header>
      <table className="w-full rounded-sm border border-[#e2e2e2] bg-white">
        <thead className="bg-[#f7f7f8] text-left text-xs text-[#787d85]">
          <tr>
            <th className="px-4 py-2 font-medium">Source</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Started</th>
            <th className="px-4 py-2 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-[#f4f4f4]">
              <td className="px-4 py-2">{r.source}</td>
              <td className="px-4 py-2">{r.status}</td>
              <td className="num px-4 py-2">{r.started_at?.slice(0, 16).replace("T", " ")}</td>
              <td className="px-4 py-2 text-xs text-[#787d85]">{r.error || JSON.stringify(r.stats ?? {})}</td>
            </tr>
          ))}
          {!runs.length && <tr><td colSpan={4} className="px-4 py-6 text-[#787d85]">No runs recorded.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
