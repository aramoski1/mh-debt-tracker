/** Same constants as pipeline/mhdebt/scoring.py and underwrite.py. Inputs are the user's, not a market guess. */

export const DSCR_TEST = 1.25;
export const LTV_CAP = 0.75;
export const AMORT_YEARS = 30;

/** Monthly payment. A term of 0 months is interest-only, matching pipeline/mhdebt/scoring.py. */
export function paymentMonths(principal: number, annualRatePct: number, months: number) {
  const r = annualRatePct / 100 / 12;
  if (months <= 0) return principal * r;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - (1 + r) ** -months);
}

export function payment(principal: number, annualRatePct: number, years: number) {
  return paymentMonths(principal, annualRatePct, years * 12);
}

export function balanceAfter(principal: number, annualRatePct: number, yearsPaid: number, amortYears = AMORT_YEARS) {
  const months = amortYears * 12;
  if (months <= 0) return principal;
  const paid = Math.min(yearsPaid * 12, months);
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal * (1 - paid / months);
  const pmt = payment(principal, annualRatePct, amortYears);
  return Math.max(0, principal * (1 + r) ** paid - pmt * (((1 + r) ** paid - 1) / r));
}

function irr(flows: number[]): number | null {
  if (!flows.some((c) => c > 0) || !flows.some((c) => c < 0)) return null;
  let rate = 0.1;
  for (let i = 0; i < 40; i++) {
    let npv = 0;
    let d = 0;
    flows.forEach((c, t) => {
      npv += c / (1 + rate) ** t;
      d += (-t * c) / (1 + rate) ** (t + 1);
    });
    if (Math.abs(d) < 1e-12) return null;
    const next = Math.max(-0.99, rate - npv / d);
    if (Math.abs(next - rate) < 1e-7) return Math.round(next * 10000) / 100;
    rate = next;
  }
  return null;
}

export type Case = {
  ok: boolean;
  why?: string;
  noi?: number;
  loan?: number;
  binding?: "ltv" | "dscr";
  equity?: number;
  cashOnCash?: number;
  irr?: number | null;
  exitValue?: number;
};

export function scenario(input: {
  price: number;
  sites: number;
  lotRent: number;
  occupancy: number;
  expense: number;
  capRate: number;
  growth: number;
  rate: number;
}): Case {
  const { price, sites, lotRent, occupancy, expense, capRate, growth, rate } = input;
  if (!(price > 0) || !(capRate > 0) || !(sites > 0)) return { ok: false, why: "Need a price, a cap rate, and a site count." };
  const base = sites * lotRent * 12 * occupancy * (1 - expense);
  const byLtv = price * LTV_CAP;
  const unit = payment(1, rate, AMORT_YEARS) * 12;
  const byDscr = unit ? base / DSCR_TEST / unit : 0;
  const binding = byLtv <= byDscr ? "ltv" : "dscr";
  const loan = Math.min(byLtv, byDscr);
  const equity = price - loan;
  if (equity <= 0) return { ok: false, why: "The loan covers the price. Lower the loan or raise the price." };
  const debt = payment(loan, rate, AMORT_YEARS) * 12;
  const flows = [-equity];
  for (let t = 1; t <= 5; t++) flows.push(base * (1 + growth) ** t - debt);
  const exitValue = (base * (1 + growth) ** 5) / (capRate / 100);
  flows[5] += exitValue - balanceAfter(loan, rate, 5);
  return {
    ok: true,
    noi: Math.round(base),
    loan: Math.round(loan),
    binding,
    equity: Math.round(equity),
    cashOnCash: Math.round(((base - debt) / equity) * 10000) / 100,
    irr: irr(flows),
    exitValue: Math.round(exitValue),
  };
}
