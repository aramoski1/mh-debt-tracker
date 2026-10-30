/** Fixed priority. A trustee sale outranks a cadence reminder. */

export type TodayItem = { id: string; rank: number; title: string; why: string; href: string; due?: string | null };

const RANK = {
  trustee: 100,
  servicing: 95,
  maturity6: 90,
  ownership: 85,
  followup: 80,
  deal: 75,
  deadline: 70,
  maturity12: 60,
  buybox: 50,
  never: 40,
  cadence: 30,
} as const;

export function rankToday(items: TodayItem[]) {
  return [...items].sort((a, b) => b.rank - a.rank || String(a.due ?? "9999").localeCompare(String(b.due ?? "9999")) || a.title.localeCompare(b.title));
}

export { RANK };
