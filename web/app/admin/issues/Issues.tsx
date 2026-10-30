"use client";

import { useState } from "react";

type Issue = { id: string; stage: string; source_ref: string | null; message: string; created_at: string };

export function Issues({ rows }: { rows: Issue[] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const open = rows.filter((row) => !hidden.includes(row.id));

  async function act(id: string, action: "dismiss" | "resolve") {
    const res = await fetch("/api/issues", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (!res.ok) {
      setErr("Could not update that issue.");
      return;
    }
    setHidden((ids) => [...ids, id]);
  }

  if (!open.length) return <p className="text-sm text-muted">No open data issues. A failed nightly source run will land here.</p>;
  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-negative">{err}</p>}
      <ul className="divide-y divide-line rounded-md border border-line bg-panel">
        {open.map((row) => (
          <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <p>{row.message}</p>
              <p className="text-xs text-muted">{row.stage}{row.source_ref ? ` · ${row.source_ref}` : ""} · {row.created_at.slice(0, 10)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="h-8 rounded-sm border border-line px-2" onClick={() => act(row.id, "dismiss")}>Dismiss</button>
              <button type="button" className="h-8 rounded-sm border border-line px-2" onClick={() => act(row.id, "resolve")}>Resolve</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
