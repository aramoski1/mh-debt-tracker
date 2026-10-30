/** Days between touches. A note does not reset the clock; a call, email, or visit does. */

export const CADENCE_DAYS = { 1: 14, 2: 30, 3: 90 } as const;

export function tierFor(input: { inPipeline: boolean; score: number | null; inBox: boolean }): 1 | 2 | 3 {
  if (input.inPipeline || (input.score ?? 0) >= 60) return 1;
  if (input.inBox) return 2;
  return 3;
}

export function cadenceDue(lastIso: string | null, tier: 1 | 2 | 3, today = new Date()) {
  if (!lastIso) return true;
  const days = CADENCE_DAYS[tier];
  const last = new Date(lastIso).getTime();
  if (Number.isNaN(last)) return true;
  return today.getTime() - last > days * 86_400_000;
}

export function bumpsClock(kind: string) {
  return kind === "call" || kind === "email" || kind === "visit";
}
