import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/Bits";
import type { ParkRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OwnersPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("park_overview").select("owner_id, owner_name, owner_state, units").eq("state", "AZ").limit(2000);
  const rows = (data ?? []) as Pick<ParkRow, "owner_id" | "owner_name" | "owner_state" | "units">[];
  const byOwner = new Map<string, { id: string; name: string; state: string | null; parks: number; sites: number }>();
  for (const row of rows) {
    if (!row.owner_id || !row.owner_name) continue;
    const cell = byOwner.get(row.owner_id) ?? { id: row.owner_id, name: row.owner_name, state: row.owner_state, parks: 0, sites: 0 };
    cell.parks += 1;
    cell.sites += row.units ?? 0;
    byOwner.set(row.owner_id, cell);
  }
  const owners = [...byOwner.values()].sort((a, b) => b.parks - a.parks || b.sites - a.sites).slice(0, 80);

  return (
    <div className="space-y-4">
      <PageHeader kicker="Owners" title="Recorded owners" lede="Grouped from the park list. This is the name on the record, not a beneficial-owner finding." />
      <section className="overflow-x-auto rounded-md border border-line bg-panel">
        <table className="w-full">
          <thead className="bg-sunken text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 font-medium">State</th>
              <th className="px-4 py-2 text-right font-medium">Parks</th>
              <th className="px-4 py-2 text-right font-medium">Sites</th>
            </tr>
          </thead>
          <tbody>
            {owners.map((owner) => (
              <tr key={owner.id} className="border-t border-line">
                <td className="px-4 py-2"><Link href={`/owners/${owner.id}`} className="font-medium hover:text-accent">{owner.name}</Link></td>
                <td className="px-4 py-2 text-muted">{owner.state ?? "—"}</td>
                <td className="num px-4 py-2 text-right">{owner.parks}</td>
                <td className="num px-4 py-2 text-right">{owner.sites.toLocaleString()}</td>
              </tr>
            ))}
            {!owners.length && <tr><td colSpan={4} className="px-4 py-6 text-muted">No owners on the loaded parks.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
