"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

type Point = Record<string, string | number | null>;

export function LineSeries({
  data, lines, unit, source,
}: {
  data: Point[];
  lines: { key: string; name: string }[];
  unit: string;
  source: string;
}) {
  return (
    <figure className="rounded-md border border-line bg-panel p-3">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--fg-muted)" }} />
            <YAxis unit={unit} tick={{ fontSize: 11, fill: "var(--fg-muted)" }} width={48} />
            {lines.map((line, i) => (
              <Line key={line.key} type="monotone" dataKey={line.key} name={line.name} stroke={i === 0 ? "var(--accent)" : "var(--fg-muted)"} strokeWidth={i === 0 ? 2 : 1} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted">{source}</figcaption>
    </figure>
  );
}

export function BarSeries({
  data, unit, source,
}: {
  data: { label: string; value: number }[];
  unit: string;
  source: string;
}) {
  return (
    <figure className="rounded-md border border-line bg-panel p-3">
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--fg-muted)" }} />
            <YAxis unit={unit} tick={{ fontSize: 11, fill: "var(--fg-muted)" }} width={40} />
            <Bar dataKey="value" fill="var(--accent)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-xs text-muted">{source}</figcaption>
    </figure>
  );
}
