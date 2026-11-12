"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Basis } from "@/components/ui/Bits";
import { Drawer } from "@/components/ui/Drawer";
import { ScorePill } from "@/components/ui/ScorePill";
import { reportedCashGap, shownPressure } from "@/lib/brief";
import { bps, dollars, money, monthYear, monthsFromNow, pct, relativeWhen, signedMoney } from "@/lib/format";
import { KIND_LABEL, LENDER_LABEL, type ParkRow } from "@/lib/types";

type Col = {
  id: string;
  label: string;
  align?: "right";
  width: number;
  value: (row: ParkRow) => string | number | null;
  cell: (row: ParkRow) => React.ReactNode;
};

function field(row: ParkRow, key: string, name: string) {
  const raw = row.score_components?.[key]?.[name];
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

const COLS: Col[] = [
  { id: "score", label: "Score", width: 108, value: (r) => shownPressure(r), cell: (r) => <ScorePill score={shownPressure(r)} /> },
  {
    id: "park", label: "Park", width: 220, value: (r) => r.name,
    cell: (r) => (
      <div className="min-w-0">
        <Link href={`/parks/${r.id}`} className="block truncate font-medium hover:text-accent" title={r.name}>{r.name}</Link>
        <div className="truncate text-xs text-muted">{KIND_LABEL[r.kind]} · {r.city ?? r.county ?? ""}</div>
      </div>
    ),
  },
  { id: "sites", label: "Sites", align: "right", width: 72, value: (r) => r.units, cell: (r) => <span className="num">{r.units ?? "—"}</span> },
  {
    id: "owner", label: "Owner", width: 180, value: (r) => r.owner_name,
    cell: (r) => <span className="block truncate" title={r.owner_name ?? ""}>{r.owner_name ?? "—"}</span>,
  },
  {
    id: "lender", label: "Lender", width: 180, value: (r) => r.lender_name ?? r.lender_name_raw,
    cell: (r) => (
      <div className="min-w-0">
        <div className="truncate">{r.lender_name ?? r.lender_name_raw ?? (r.loan_id ? "Unknown" : "No loan found")}</div>
        <div className="truncate text-xs text-muted">{r.lender_kind ? LENDER_LABEL[r.lender_kind] : ""}</div>
      </div>
    ),
  },
  {
    id: "balance", label: "Balance", align: "right", width: 96, value: (r) => r.current_balance,
    cell: (r) => <span className="num">{money(r.current_balance)}</span>,
  },
  { id: "note", label: "Note rate", align: "right", width: 88, value: (r) => r.note_rate, cell: (r) => <span className="num">{pct(r.note_rate)}</span> },
  {
    id: "today", label: "Today's rate", align: "right", width: 96, value: (r) => field(r, "rate_shock", "new_rate"),
    cell: (r) => <span className="num">{pct(field(r, "rate_shock", "new_rate"))}</span>,
  },
  {
    id: "shock", label: "Rate shock", align: "right", width: 96,
    value: (r) => {
      const oldRate = field(r, "rate_shock", "old_rate");
      const next = field(r, "rate_shock", "new_rate");
      return oldRate == null || next == null ? null : next - oldRate;
    },
    cell: (r) => {
      const oldRate = field(r, "rate_shock", "old_rate");
      const next = field(r, "rate_shock", "new_rate");
      return <span className="num">{oldRate == null || next == null ? "—" : bps(next - oldRate)}</span>;
    },
  },
  {
    id: "matures", label: "Matures", width: 140, value: (r) => r.maturity_date,
    cell: (r) => {
      const months = monthsFromNow(r.maturity_date);
      return (
        <div>
          <div className={`num ${months != null && months >= 0 && months <= 12 ? "font-semibold text-accent" : ""}`}>{monthYear(r.maturity_date)}</div>
          <div className="text-xs text-muted">
            {r.loan_status === "foreclosure" ? <span className="font-semibold text-accent">Foreclosure notice</span> : <Basis basis={r.maturity_basis} />}
            {relativeWhen(r.maturity_date) ? ` · ${relativeWhen(r.maturity_date)}` : ""}
          </div>
        </div>
      );
    },
  },
  {
    id: "gap", label: "Refi gap", align: "right", width: 96, value: (r) => reportedCashGap(r),
    cell: (r) => <span className="num">{signedMoney(reportedCashGap(r))}</span>,
  },
  {
    id: "contact", label: "Last contact", width: 110, value: (r) => r.last_activity_at,
    cell: (r) => <span className="num">{r.last_activity_at ? monthYear(r.last_activity_at) : "—"}</span>,
  },
];

function csv(rows: ParkRow[]) {
  const head = COLS.map((c) => c.label).join(",");
  const body = rows.map((row) => COLS.map((c) => {
    const v = c.value(row);
    return `"${String(v ?? "").replace(/"/g, '""')}"`;
  }).join(","));
  return [head, ...body].join("\n");
}

export default function ProspectTable({ rows, onHover }: { rows: ParkRow[]; onHover: (id: string | null) => void }) {
  const parent = useRef<HTMLDivElement>(null);
  const [sorts, setSorts] = useState<{ id: string; desc: boolean }[]>([{ id: "score", desc: true }]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [widths, setWidths] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState<ParkRow | null>(null);
  const [dense, setDense] = useState(false);
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("desk-table");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { hidden?: string[]; dense?: boolean };
      setHidden(parsed.hidden ?? []);
      setDense(!!parsed.dense);
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => {
    localStorage.setItem("desk-table", JSON.stringify({ hidden, dense }));
  }, [hidden, dense]);

  const visible = COLS.filter((c) => !hidden.includes(c.id));
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      for (const sort of sorts) {
        const col = COLS.find((c) => c.id === sort.id);
        const av = col?.value(a) ?? null;
        const bv = col?.value(b) ?? null;
        if (av == null && bv == null) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return sort.desc ? 1 : -1;
        if (av > bv) return sort.desc ? -1 : 1;
      }
      return 0;
    });
    return copy;
  }, [rows, sorts]);

  const rowHeight = dense ? 36 : 52;
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parent.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });
  const items = virtualizer.getVirtualItems();
  const padTop = items.length ? items[0].start : 0;
  const padBot = items.length ? virtualizer.getTotalSize() - items[items.length - 1].end : 0;

  const toggleSort = (id: string, shift: boolean) => {
    setSorts((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (!shift) return [{ id, desc: i === 0 ? !prev[0].desc : true }];
      if (i >= 0) return prev.map((s, n) => n === i ? { id, desc: !s.desc } : s);
      return [...prev, { id, desc: false }];
    });
  };

  const exportRows = (which: ParkRow[]) => {
    const blob = new Blob([csv(which)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `park-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const addPipeline = async (which: ParkRow[]) => {
    setNote(null);
    const results = await Promise.all(which.map((row) => fetch("/api/deals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parkId: row.id, stage: "target" }),
    })));
    setNote(results.every((r) => r.ok) ? `Added ${which.length} to the pipeline.` : "Could not add every park. Sign in and try again.");
  };

  const onKey = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((n) => Math.min(sorted.length - 1, n + 1));
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((n) => Math.max(0, n - 1));
    } else if (e.key === "Enter") {
      const row = sorted[cursor];
      if (row) setOpen(row);
    } else if (e.key === "x") {
      const row = sorted[cursor];
      if (!row) return;
      setPicked((prev) => {
        const next = new Set(prev);
        if (next.has(row.id)) next.delete(row.id);
        else next.add(row.id);
        return next;
      });
    } else if (e.key === "e") {
      exportRows(picked.size ? sorted.filter((r) => picked.has(r.id)) : sorted);
    }
  };

  useEffect(() => {
    onHover(sorted[cursor]?.id ?? null);
    virtualizer.scrollToIndex(cursor, { align: "auto" });
    // The virtualizer instance is recreated each render. Cursor is the signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, sorted]);

  const selected = sorted.filter((r) => picked.has(r.id));

  return (
    <div className="rounded-md border border-line bg-panel" onKeyDown={onKey} tabIndex={0}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-2 text-xs text-muted">
        <span className="num">{sorted.length.toLocaleString()} parks</span>
        <button type="button" className="text-accent" onClick={() => setDense((v) => !v)}>{dense ? "Comfortable" : "Compact"}</button>
        <button type="button" className="text-accent" onClick={() => setMenu((v) => !v)}>Columns</button>
        <button type="button" className="text-accent" onClick={() => exportRows(selected.length ? selected : sorted)}>Export</button>
        <span className="ml-auto">j/k move · Enter open · x select · e export</span>
      </div>
      {menu && (
        <div className="flex flex-wrap gap-3 border-b border-line px-3 py-2 text-sm">
          {COLS.map((col) => (
            <label key={col.id} className="flex items-center gap-1">
              <input type="checkbox" checked={!hidden.includes(col.id)} onChange={() => setHidden((prev) => prev.includes(col.id) ? prev.filter((id) => id !== col.id) : [...prev, col.id])} />
              {col.label}
            </label>
          ))}
        </div>
      )}
      {!!selected.length && (
        <div className="flex items-center gap-3 border-b border-line bg-sunken px-3 py-2 text-sm">
          <span className="num">{selected.length} selected</span>
          <button type="button" className="h-8 rounded-sm bg-accent px-3 text-on-accent" onClick={() => addPipeline(selected)}>Add to pipeline</button>
          <button type="button" className="h-8 rounded-sm border border-line px-3" onClick={() => exportRows(selected)}>Export</button>
          {note && <span className="text-xs text-muted">{note}</span>}
        </div>
      )}
      <div ref={parent} className="max-h-[640px] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead className="sticky top-0 z-10 bg-sunken text-xs text-muted">
            <tr>
              <th className="w-8 border-b border-line px-2 py-2" />
              {visible.map((col, i) => (
                <th key={col.id} className={`border-b border-line px-2 py-2 font-medium ${col.align === "right" ? "text-right" : "text-left"} ${i === 0 ? "sticky left-8 bg-sunken" : ""}`} style={{ minWidth: widths[col.id] ?? col.width }}>
                  <button type="button" className="inline-flex items-center gap-1" onClick={(e) => toggleSort(col.id, e.shiftKey)}>
                    {col.label}
                    {sorts.find((s) => s.id === col.id) ? (sorts.find((s) => s.id === col.id)?.desc ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {padTop > 0 && <tr><td colSpan={visible.length + 1} style={{ height: padTop }} /></tr>}
            {items.map((item) => {
              const row = sorted[item.index];
              const on = item.index === cursor;
              return (
                <tr
                  key={row.id}
                  className={`${on ? "bg-sunken" : ""} hover:bg-sunken`}
                  onMouseEnter={() => onHover(row.id)}
                  onClick={() => { setCursor(item.index); setOpen(row); }}
                >
                  <td className="border-b border-line px-2">
                    <input aria-label={`Select ${row.name}`} type="checkbox" checked={picked.has(row.id)} onClick={(e) => e.stopPropagation()} onChange={() => setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(row.id)) next.delete(row.id); else next.add(row.id);
                      return next;
                    })} />
                  </td>
                  {visible.map((col, i) => (
                    <td key={col.id} className={`border-b border-line px-2 py-1 ${col.align === "right" ? "text-right" : ""} ${i === 0 ? "sticky left-8 bg-panel" : ""}`}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {padBot > 0 && <tr><td colSpan={visible.length + 1} style={{ height: padBot }} /></tr>}
          </tbody>
        </table>
        {!sorted.length && <p className="px-3 py-8 text-sm text-muted">No parks match these filters. Clear a filter or widen the site count.</p>}
      </div>
      <Drawer open={!!open} onOpenChange={(next) => { if (!next) setOpen(null); }} title={open?.name ?? "Park"}>
        {open && (
          <div className="space-y-3 text-sm">
            <ScorePill score={shownPressure(open)} />
            <p>{[open.city, open.state].filter(Boolean).join(", ")} · {open.units ?? "—"} sites</p>
            <p>Lender {open.lender_name ?? open.lender_name_raw ?? "—"}</p>
            <p className="num">Matures {monthYear(open.maturity_date)} <Basis basis={open.maturity_basis} /></p>
            <p className="num">Balance {money(open.current_balance)}</p>
            <p className="num">Cash the owner must bring {dollars(reportedCashGap(open))}</p>
            <Link href={`/parks/${open.id}`} className="inline-block font-medium text-accent">Open the full page</Link>
          </div>
        )}
      </Drawer>
    </div>
  );
}
