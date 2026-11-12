"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AskDesk } from "@/components/ui/AskDesk";
import { Metric, MetricStrip } from "@/components/ui/Bits";
import { DESK_MODULES, resolveDesk, type DeskModuleId } from "@/lib/desk";
import type { TodayItem } from "@/lib/today";
import { money, monthYear, scoreTone } from "@/lib/format";
import { STAGE_LABEL } from "@/lib/stages";
import { Customize } from "./Customize";
import type { FollowUp } from "../FollowUps";

type Call = { id: string; name: string; city: string | null; line: string; score: number | null; matures: string | null; contacted: string };
type ParkLink = { id: string; name: string; city: string | null; score: number | null };
type Stage = { id: string; label: string; count: number; debt: number };

export function DeskView({
  counts,
  followups,
  calls,
  unworked,
  distress,
  stages,
  today,
  ranked,
}: {
  counts: { parks: number; dueYear: number; debt: string; documented: number; foreclosure: number };
  followups: FollowUp[];
  calls: Call[];
  unworked: ParkLink[];
  distress: ParkLink[];
  stages: Stage[];
  today: string;
  ranked: TodayItem[];
}) {
  const [visible, setVisible] = useState<Record<DeskModuleId, boolean>>(resolveDesk(null));
  const [order, setOrder] = useState<DeskModuleId[]>(DESK_MODULES.map(([id]) => id));
  const onChange = useCallback((next: Record<DeskModuleId, boolean>, nextOrder: DeskModuleId[]) => {
    setVisible(next);
    setOrder(nextOrder);
  }, []);
  const show = (id: DeskModuleId) => visible[id];
  const place = (id: DeskModuleId) => ({ order: order.indexOf(id) });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted">Today</p>
          <h1 className="text-xl font-medium">What to work</h1>
        </div>
        <Customize onChange={onChange} />
      </div>

      <div className="flex flex-col gap-4">
      {show("today") && (
        <section className="rounded-md border border-line bg-panel" style={place("today")}>
          <h2 className="border-b border-line px-4 py-2 text-sm font-medium">Do these today · {ranked.length}</h2>
          {ranked.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Nothing in the priority list. A trustee sale, a reported maturity, or a due follow-up will land here.</p>
          ) : (
            <ol className="divide-y divide-line">
              {ranked.map((row, index) => (
                <li key={row.id} className="px-4 py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="num text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                    <Link href={row.href} className="font-medium hover:text-accent">{row.title}</Link>
                    {row.due && <span className="num text-xs text-muted">{row.due}</span>}
                  </div>
                  <p className="mt-1 text-sm text-body">{row.why}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
      {show("kpis") && (
        <div style={place("kpis")}>
        <MetricStrip>
          <Metric label="Parks in Arizona" value={counts.parks.toLocaleString()} />
          <Metric label="Due within 12 months" value={counts.dueYear.toLocaleString()} />
          <Metric label="Balance" value={counts.debt} />
          <Metric label="Date from a document" value={counts.documented.toLocaleString()} detail={counts.foreclosure ? `${counts.foreclosure} foreclosure notices` : undefined} />
        </MetricStrip>
        </div>
      )}
      {show("ask") && <div style={place("ask")}><AskDesk /></div>}
      {show("followups") && (
        <section className="rounded-md border border-line bg-panel" style={place("followups")}>
          <h2 className="border-b border-line px-4 py-2 text-sm font-medium">Follow-ups due</h2>
          {followups.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Nothing is due in the next seven days. Set a next action on a park.</p>
          ) : (
            <ul className="divide-y divide-line">
              {followups.map((row) => (
                <li key={`${row.parkId}-${row.when}`} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
                  <Link href={`/parks/${row.parkId}`} className="font-medium hover:text-accent">{row.name}</Link>
                  <span className="text-xs text-muted"><span className="num">{row.when}</span>{row.when < today ? " · overdue" : ""} · {row.why}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {show("calls") && (
        <section className="rounded-md border border-line bg-panel" style={place("calls")}>
          <h2 className="border-b border-line px-4 py-2 text-sm font-medium">Calls worth making</h2>
          {calls.length === 0 ? <p className="px-4 py-3 text-sm text-muted">No untouched pressure in the book.</p> : (
            <ul className="divide-y divide-line">
              {calls.map((row) => (
                <li key={row.id} className="px-4 py-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link href={`/parks/${row.id}`} className="text-sm font-medium hover:text-accent">{row.name}</Link>
                    <span className="text-xs text-muted">{row.city}</span>
                    <span className="text-xs text-muted">{row.contacted}</span>
                    <span className={`num ml-auto rounded-sm px-1.5 text-sm font-semibold ${scoreTone(row.score)}`}>{row.score == null ? "–" : Number(row.score).toFixed(1)}</span>
                  </div>
                  <p className="text-xs leading-5 text-body">{row.line}</p>
                  <p className="num text-xs text-muted">{monthYear(row.matures)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {show("unworked") && (
        <section className="rounded-md border border-line bg-panel" style={place("unworked")}>
          <h2 className="border-b border-line px-4 py-2 text-sm font-medium">High score, never logged</h2>
          {unworked.length === 0 ? <p className="px-4 py-3 text-sm text-muted">Every park scoring 50 or higher has a note.</p> : (
            <ul className="divide-y divide-line">
              {unworked.map((park) => (
                <li key={park.id} className="flex items-baseline justify-between px-4 py-2 text-sm">
                  <Link href={`/parks/${park.id}`} className="font-medium hover:text-accent">{park.name}</Link>
                  <span className="text-xs text-muted">{park.city} · <span className="num">{park.score == null ? "—" : Number(park.score).toFixed(1)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {show("distress") && (
        <section className="rounded-md border border-line bg-panel" style={place("distress")}>
          <h2 className="border-b border-line px-4 py-2 text-sm font-medium">Foreclosure notices</h2>
          {distress.length === 0 ? <p className="px-4 py-3 text-sm text-muted">No trustee sale or lis pendens is matched to a park in this book.</p> : (
            <ul className="divide-y divide-line">
              {distress.map((park) => (
                <li key={park.id} className="flex items-baseline justify-between px-4 py-2 text-sm">
                  <Link href={`/parks/${park.id}`} className="font-medium hover:text-accent">{park.name}</Link>
                  <span className="text-xs text-muted">{park.city}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {show("pipeline") && (
        <section className="rounded-md border border-line bg-panel" style={place("pipeline")}>
          <div className="flex items-baseline justify-between border-b border-line px-4 py-2">
            <h2 className="text-sm font-medium">Pipeline</h2>
            <Link href="/pipeline" className="text-xs text-accent">Open the board</Link>
          </div>
          <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
            {stages.map((stage) => (
              <li key={stage.id} className="bg-panel px-4 py-2">
                <p className="text-xs text-muted">{stage.label}</p>
                <p className="num text-sm">{stage.count}{stage.debt ? ` · ${money(stage.debt)}` : ""}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </div>
  );
}
