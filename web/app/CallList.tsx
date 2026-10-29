import Link from "next/link";
import { callLine, callTargets } from "@/lib/brief";
import { monthYear, scoreTone } from "@/lib/format";
import type { ParkRow } from "@/lib/types";

export default function CallList({ rows }: { rows: ParkRow[] }) {
  const targets = callTargets(rows);
  return (
    <section className="overflow-hidden rounded-sm border border-[#e2e2e2] bg-white">
      <div className="flex items-end justify-between gap-4 border-b border-[#dd9933] bg-[#18191b] px-4 py-3 text-white">
        <div>
          <p className="text-[10px] font-medium tracking-[0.22em] text-[#dd9933]">THIS WEEK</p>
          <h2 className="text-lg font-medium">Calls worth making</h2>
        </div>
        <p className="max-w-sm text-right text-xs text-white/70">
          Highest pressure, due inside a year, or a foreclosure notice, and nobody on the team has logged a call in 60 days.
        </p>
      </div>
      {targets.length === 0 ? (
        <p className="px-4 py-6 text-[#787d85]">Nothing in this view is both urgent and untouched. Widen the filters or clear a few notes.</p>
      ) : (
        <ol className="divide-y divide-[#f4f4f4]">
          {targets.map((r, i) => (
            <li key={r.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:items-center">
              <span className="num text-xs text-[#787d85]">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Link href={`/parks/${r.id}`} className="font-medium text-[#18191b] hover:text-[#85152a]">
                    {r.name}
                  </Link>
                  <span className="text-xs text-[#787d85]">{r.city}</span>
                  {r.phone && <a className="num text-xs text-[#85152a]" href={`tel:${r.phone}`}>{r.phone}</a>}
                </div>
                <p className="mt-0.5 text-xs leading-5 text-[#333539]">{callLine(r)}</p>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <span className="num text-xs text-[#787d85]">{monthYear(r.maturity_date)}</span>
                <span className={`num inline-block min-w-9 rounded-sm px-1.5 py-0.5 text-center text-sm font-semibold ${scoreTone(r.score)}`}>
                  {r.score == null ? "–" : Math.round(r.score)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
