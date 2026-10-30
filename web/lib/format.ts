export const money = (v: number | null | undefined) =>
  v == null
    ? "—"
    : v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}M`
      : v >= 1_000
        ? `$${Math.round(v / 1_000)}K`
        : `$${Math.round(v)}`;

export const pct = (v: number | null | undefined, digits = 2) => (v == null ? "—" : `${Number(v).toFixed(digits)}%`);

export function monthYear(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m] = d.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}

export function monthsFromNow(d: string | null | undefined) {
  if (!d) return null;
  const [y, m] = d.split("-").map(Number);
  const now = new Date();
  return (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
}

export function scoreTone(s: number | null | undefined) {
  if (s == null) return "bg-score-calm text-on-score-calm";
  if (s >= 60) return "bg-score-severe text-on-score-severe";
  if (s >= 45) return "bg-score-high text-on-score-high";
  if (s >= 30) return "bg-score-mid text-on-score-mid";
  return "bg-score-calm text-on-score-calm";
}

export function scoreLabel(s: number | null | undefined) {
  if (s == null) return "No score";
  if (s >= 60) return "Severe";
  if (s >= 45) return "High";
  if (s >= 30) return "Elevated";
  return "Calm";
}

export function fullDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return monthYear(d);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${day}, ${y}`;
}

export function relativeWhen(d: string | null | undefined) {
  const months = monthsFromNow(d);
  if (months == null) return null;
  if (months < 0) return `${Math.abs(months)} mo ago`;
  if (months === 0) return "this month";
  return `in ${months} mo`;
}

export function bps(points: number | null | undefined) {
  if (points == null || Number.isNaN(points)) return "—";
  const n = Math.round(Number(points) * 100);
  return `${n > 0 ? "+" : ""}${n} bps`;
}

export function ratio(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Number(v).toFixed(2)}x`;
}
