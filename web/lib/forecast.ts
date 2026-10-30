/** Probability weights for a buyer's pipeline. Dead and closed are decided, not forecast. */

export const STAGE_PROBABILITY: Record<string, number> = {
  target: 0.05,
  contacted: 0.1,
  in_conversation: 0.2,
  underwriting: 0.35,
  loi: 0.5,
  due_diligence: 0.7,
  under_contract: 0.7,
  closed: 1,
  passed: 0,
};

export function forecast(deals: { stage: string; price: number | null; sites: number | null; close_date: string | null }[]) {
  const open = deals.filter((deal) => deal.stage !== "closed" && deal.stage !== "passed");
  const weighted = open.reduce((sum, deal) => sum + (deal.price ?? 0) * (STAGE_PROBABILITY[deal.stage] ?? 0), 0);
  const sites = open.reduce((sum, deal) => sum + (deal.sites ?? 0) * (STAGE_PROBABILITY[deal.stage] ?? 0), 0);
  const decided = deals.filter((deal) => deal.stage === "closed" || deal.stage === "passed");
  const won = decided.filter((deal) => deal.stage === "closed").length;
  return {
    weighted,
    sites,
    won,
    decided: decided.length,
    byMonth: open.filter((deal) => deal.close_date).reduce<Record<string, number>>((bag, deal) => {
      const key = (deal.close_date ?? "").slice(0, 7);
      bag[key] = (bag[key] ?? 0) + (deal.price ?? 0) * (STAGE_PROBABILITY[deal.stage] ?? 0);
      return bag;
    }, {}),
  };
}
