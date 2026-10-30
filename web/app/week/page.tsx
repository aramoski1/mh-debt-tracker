import Link from "next/link";
import { PageHeader } from "@/components/ui/Bits";
import { callLine, callTargets } from "@/lib/brief";
import { supabaseServer } from "@/lib/supabase/server";
import type { ParkRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WeekPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("park_overview").select("*").eq("state", "AZ").order("score", { ascending: false }).limit(2000);
  const rows = (data ?? []) as ParkRow[];
  const targets = callTargets(rows, 12);
  const worked = targets.filter((park) => park.last_activity_at).length;
  return (
    <div className="space-y-4">
      <PageHeader kicker="Work" title="This week" lede={`${worked} of ${targets.length || 0} call targets have a logged touch. The target is the list, not a dollar quota.`} />
      {targets.length === 0 ? <p className="text-sm text-muted">No untouched pressure in the book. Widen the book or log the calls you have made.</p> : (
        <ol className="divide-y divide-line rounded-md border border-line bg-panel">
          {targets.map((park, index) => (
            <li key={park.id} className="px-4 py-3">
              <div className="flex items-baseline gap-2">
                <span className="num text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                <Link href={`/parks/${park.id}`} className="font-medium hover:text-accent">{park.name}</Link>
                <span className="text-xs text-muted">{park.city}</span>
              </div>
              <p className="mt-1 text-sm text-body">{callLine(park)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
