import Link from "next/link";
import { callLine, callTargets, shownPressure } from "@/lib/brief";
import { monthYear, scoreTone } from "@/lib/format";
import type { ParkRow } from "@/lib/types";

function contacted(iso: string | null | undefined) {
  if (!iso) return "Never logged";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (Number.isNaN(days) || days < 0) return "Never logged";
  if (days === 0) return "Logged today";
  return `Logged ${days}d ago`;
}

export default function CallList({ rows }: { rows: ParkRow[] }) {
  const targets = callTargets(rows);
  return (
    <section className="overflow-hidden rounded-sm border border-line bg-panel">
      <div className="flex items-end justify-between gap-4 border-b border-gold bg-inverse px-4 py-3 text-on-inverse">
        <div>
          <p className="text-2xs font-medium tracking-wide text-gold">This week</p>
          <h2 className="text-lg font-medium">Calls worth making</h2>
        </div>
        <p className="max-w-sm text-right text-xs text-on-inverse/70">
          Highest pressure, due inside a year, or a foreclosure notice, and nobody on the team has logged a call in 60 days.
        </p>
      </div>
      {targets.length === 0 ? (
        <p className="px-4 py-6 text-muted">Nothing in this view is both urgent and untouched. Widen the filters or clear a few notes.</p>
      ) : (
        <ol className="divide-y divide-line">
          {targets.map((r, i) => (
            <li key={r.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
              <span className="num text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link href={`/parks/${r.id}`} className="font-medium text-fg hover:text-accent">
                    {r.name}
                  </Link>
                  <span className="text-xs text-muted">{r.city}</span>
                  <span className="text-xs text-muted">{contacted(r.last_activity_at)}</span>
                  {r.phone && <a className="num text-xs text-accent" href={`tel:${r.phone}`}>{r.phone}</a>}
                </div>
                <p className="mt-0.5 text-xs leading-5 text-body">{callLine(r)}</p>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <span className="num text-xs text-muted">{monthYear(r.maturity_date)}</span>
                <span className={`num inline-block min-w-9 rounded-sm px-1.5 py-0.5 text-center text-sm font-semibold ${scoreTone(shownPressure(r))}`}>
                  {shownPressure(r) == null ? "–" : shownPressure(r)!.toFixed(1)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
