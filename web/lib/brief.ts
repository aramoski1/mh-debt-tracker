import { BASIS_LABEL, type ParkRow, type ScoreComponent } from "./types";
import { dollars, monthYear, monthsFromNow } from "./format";

function coverageCounts(c?: ScoreComponent | null) {
  return Boolean(c && c.scored !== false && c.points != null && c.noi_basis === "reported");
}

/** The score on screen. A park with no loan is blank. Points from an invented NOI are left out. */
export function shownPressure(r: Pick<ParkRow, "loan_id" | "score" | "score_components">): number | null {
  if (!r.loan_id || r.score == null) return null;
  const gap = r.score_components?.refi_gap;
  const stale = gap && !coverageCounts(gap) && typeof gap.points === "number" ? gap.points : 0;
  return Math.round((r.score - stale) * 10) / 10;
}

/** Cash the owner must bring. Reported NOI and a reported balance. An estimated balance stays off this line. */
export function reportedCashGap(r: Pick<ParkRow, "score_components">): number | null {
  const gap = r.score_components?.refi_gap;
  if (!coverageCounts(gap) || gap?.balance_basis !== "reported" || typeof gap?.equity_needed !== "number") return null;
  return gap.equity_needed;
}

/** One sentence to say out loud before dialing. Built only from fields already on the park. */
export function callLine(r: ParkRow): string {
  const gap = r.score_components?.refi_gap;
  const equity = typeof gap?.equity_needed === "number" ? gap.equity_needed : null;
  const months = monthsFromNow(r.maturity_date);
  if (r.loan_status === "foreclosure") return "A trustee sale or lis pendens is on the record. Ask if they want a buyer before the sale date.";
  if (months != null && months <= 12 && (r.maturity_basis === "reported" || r.maturity_basis === "document")) {
    return `The loan is documented through ${monthYear(r.maturity_date)}. Ask what they have lined up to replace it.`;
  }
  if (equity != null && equity > 0 && coverageCounts(gap) && gap?.balance_basis === "reported") {
    if (String(gap.why ?? "").includes("75% of price (desk cap) binds")) {
      return `A saved price caps a new loan at 75% of price. Cash the owner must bring is ${dollars(equity)}. That figure is the price cap, not a shortfall in reported income.`;
    }
    return `Refinancing on a 25-year bank amortization looks short about ${dollars(equity)} on their reported income. Ask whether they would rather bring cash or sell.`;
  }
  if (months != null && months <= 18) {
    const basis = r.maturity_basis ? BASIS_LABEL[r.maturity_basis].toLowerCase() : "estimated";
    return `The loan is ${basis} to come due ${monthYear(r.maturity_date)}. Confirm the real date and whether they want to hold.`;
  }
  const why = r.score_components?.owner?.why;
  if (why) return why;
  return "The ownership and the loan timing are worth a conversation about a sale or a refinance.";
}

const STALE_MS = 60 * 24 * 60 * 60 * 1000;

export function callTargets(rows: ParkRow[], limit = 8): ParkRow[] {
  const now = Date.now();
  return rows.filter((r) => {
    const months = monthsFromNow(r.maturity_date);
    const hot = (shownPressure(r) ?? 0) >= 40 || (months != null && months <= 12) || r.loan_status === "foreclosure";
    if (!hot) return false;
    if (!r.last_activity_at) return true;
    return now - new Date(r.last_activity_at).getTime() > STALE_MS;
  }).slice(0, limit);
}
