/** Which blocks the Today page shows. Stored in this browser. Missing keys stay visible. */

export const DESK_MODULES = [
  ["today", "Do these today"],
  ["kpis", "Counts"],
  ["ask", "Ask"],
  ["followups", "Follow-ups"],
  ["calls", "Calls worth making"],
  ["unworked", "Never called"],
  ["distress", "Foreclosure notices"],
  ["pipeline", "Pipeline"],
] as const;

export type DeskModuleId = (typeof DESK_MODULES)[number][0];

export function resolveDesk(stored: Partial<Record<DeskModuleId, boolean>> | null): Record<DeskModuleId, boolean> {
  const visible = Object.fromEntries(DESK_MODULES.map(([id]) => [id, true])) as Record<DeskModuleId, boolean>;
  if (!stored) return visible;
  for (const [id] of DESK_MODULES) {
    if (typeof stored[id] === "boolean") visible[id] = stored[id];
  }
  return visible;
}

export function resolveOrder(stored: string[] | null): DeskModuleId[] {
  const known = DESK_MODULES.map(([id]) => id);
  const ids = (stored ?? []).filter((id): id is DeskModuleId => (known as string[]).includes(id));
  for (const id of known) if (!ids.includes(id)) ids.push(id);
  return ids;
}
