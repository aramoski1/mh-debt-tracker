"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BASIS_LABEL, KIND_LABEL, LENDER_LABEL, type ParkRow } from "@/lib/types";
import { money, monthYear, monthsFromNow, scoreTone } from "@/lib/format";
import ParkMap from "./ParkMap";

function toCsv(rows: ParkRow[]) {
  const cols: (keyof ParkRow)[] = ["name", "address", "city", "state", "zip", "units", "kind", "score", "owner_name",
    "owner_city", "owner_state", "lender_name", "lender_kind", "original_amount", "maturity_date", "maturity_basis"];
  const esc = (v: unknown) => (v == null ? "" : `"${String(v).replace(/"/g, '""')}"`);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export default function Prospects({ rows }: { rows: ParkRow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const stats = useMemo(() => {
    const known = rows.filter((r) => r.maturity_basis === "reported" || r.maturity_basis === "document").length;
    const within12 = rows.filter((r) => {
      const m = monthsFromNow(r.maturity_date);
      return m != null && m <= 12;
    }).length;
    return { total: rows.length, known, within12 };
  }, [rows]);

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `park-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.5fr)]">
      <div className="h-[380px] overflow-hidden rounded border border-stone-200 xl:sticky xl:top-16 xl:h-[calc(100vh-150px)]">
        <ParkMap rows={rows} highlight={hover} />
      </div>
      <div className="overflow-x-auto rounded border border-stone-200 bg-white">
        <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2 text-stone-600">
          <span className="num">
            {stats.total.toLocaleString()} parks · {stats.within12.toLocaleString()} maturing within 12 months ·{" "}
            {stats.known.toLocaleString()} with a known date
          </span>
          <button onClick={download} className="text-stone-500 hover:text-stone-900">
            Export CSV
          </button>
        </div>
        <table className="w-full min-w-[860px]">
          <thead className="bg-stone-50 text-left text-xs text-stone-500">
            <tr>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Park</th>
              <th className="px-3 py-2 text-right font-medium">Sites</th>
              <th className="px-3 py-2 font-medium">Lender</th>
              <th className="px-3 py-2 text-right font-medium">Loan</th>
              <th className="px-3 py-2 font-medium">Matures</th>
              <th className="px-3 py-2 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = monthsFromNow(r.maturity_date);
              return (
                <tr key={r.id} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(null)}
                    className="border-t border-stone-100 align-top hover:bg-stone-50">
                  <td className="px-3 py-2">
                    <span className={`num inline-block w-9 rounded px-1 py-0.5 text-center font-semibold ${scoreTone(r.score)}`}>
                      {r.score == null ? "–" : Math.round(r.score)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/parks/${r.id}`} className="block max-w-[230px] truncate font-medium hover:underline" title={r.name}>
                      {r.name}
                    </Link>
                    <div className="text-xs text-stone-500">
                      {KIND_LABEL[r.kind]} · {r.city ?? r.county ?? ""}
                    </div>
                  </td>
                  <td className="num px-3 py-2 text-right">{r.units ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="max-w-[180px] truncate">{r.lender_name ?? r.lender_name_raw ?? (r.loan_id ? "Unknown" : "No loan found")}</div>
                    <div className="text-xs text-stone-500">{r.lender_kind ? LENDER_LABEL[r.lender_kind] : ""}</div>
                  </td>
                  <td className="num px-3 py-2 text-right">{money(r.current_balance ?? r.original_amount)}</td>
                  <td className="px-3 py-2">
                    <div className={`num whitespace-nowrap ${m != null && m <= 12 ? "font-semibold text-red-800" : ""}`}>
                      {monthYear(r.maturity_date)}
                    </div>
                    <div className="text-xs text-stone-500">
                      {r.loan_status === "foreclosure" ? (
                        <span className="font-semibold text-red-800">Foreclosure notice</span>
                      ) : r.maturity_basis ? BASIS_LABEL[r.maturity_basis] + (m != null && m < 0 ? " · passed" : "") : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="max-w-[190px] truncate" title={r.owner_name ?? ""}>{r.owner_name ?? "—"}</div>
                    <div className="text-xs text-stone-500">
                      {[r.owner_city, r.owner_state].filter(Boolean).join(", ")}
                      {r.owner_park_count && r.owner_park_count > 1 ? ` · ${r.owner_park_count} parks` : ""}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-stone-500">
                  No parks match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
