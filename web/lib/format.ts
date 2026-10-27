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
  if (s == null) return "bg-stone-100 text-stone-500";
  if (s >= 60) return "bg-red-700 text-white";
  if (s >= 45) return "bg-amber-600 text-white";
  if (s >= 30) return "bg-amber-100 text-amber-900";
  return "bg-stone-100 text-stone-600";
}
