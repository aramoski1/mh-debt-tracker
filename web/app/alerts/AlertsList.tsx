"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type AlertRow = {
  id: string;
  park_id: string | null;
  kind: string;
  title: string;
  detail: string | null;
  created_at: string;
  seen_at: string | null;
  parks?: { name?: string | null; city?: string | null } | null;
};

const KIND: Record<string, string> = {
  distress: "Distress",
  new_loan: "New loan",
  maturity_window: "Maturing",
  score_jump: "Score jump",
  release: "Payoff",
};

export default function AlertsList({ rows }: { rows: AlertRow[] }) {
  const [seen, setSeen] = useState<Set<string>>(new Set(rows.filter((row) => row.seen_at).map((row) => row.id)));
  const [kind, setKind] = useState("all");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, AlertRow[]>();
    for (const row of rows) {
      if (hidden.has(row.id)) continue;
      if (kind !== "all" && row.kind !== kind) continue;
      const day = row.created_at.slice(0, 10);
      map.set(day, [...(map.get(day) ?? []), row]);
    }
    return [...map.entries()];
  }, [rows, kind, hidden]);

  const mark = async (ids: string[]) => {
    setSeen((prev) => new Set([...prev, ...ids]));
    const res = await fetch("/api/alerts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) setMsg("Could not mark those read. Try again after you sign in.");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted" htmlFor="alert-kind">Type</label>
        <select id="alert-kind" value={kind} onChange={(e) => setKind(e.target.value)} className="h-8 rounded-sm border border-line bg-panel px-2 text-sm">
          <option value="all">All</option>
          {Object.entries(KIND).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <button type="button" className="h-8 rounded-sm border border-line px-3 text-sm" onClick={() => mark(rows.filter((row) => !seen.has(row.id)).map((row) => row.id))}>Mark all read</button>
        {msg && <span className="text-xs text-muted">{msg}</span>}
      </div>
      {groups.map(([day, items]) => (
        <section key={day} className="overflow-hidden rounded-md border border-line bg-panel">
          <h2 className="border-b border-line bg-sunken px-4 py-2 text-xs text-muted">{day}</h2>
          <ul>
            {items.map((row) => (
              <li key={row.id} className={`flex flex-wrap items-start gap-3 border-t border-line px-4 py-3 ${seen.has(row.id) ? "text-muted" : ""}`}>
                <span className="w-24 shrink-0 text-xs text-accent">{KIND[row.kind] ?? row.kind}</span>
                <div className="min-w-0 flex-1">
                  {row.park_id ? <Link href={`/parks/${row.park_id}`} className="font-medium hover:text-accent">{row.title}</Link> : row.title}
                  {row.detail && <p className="text-xs text-muted">{row.detail}</p>}
                </div>
                {!seen.has(row.id) && <button type="button" className="text-xs text-accent" onClick={() => mark([row.id])}>Mark read</button>}
                <button type="button" className="text-xs text-muted" onClick={() => setHidden((prev) => new Set(prev).add(row.id))}>Snooze</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {!groups.length && <p className="rounded-md border border-line bg-panel px-4 py-8 text-sm text-muted">Nothing new since the last scoring run.</p>}
    </div>
  );
}
