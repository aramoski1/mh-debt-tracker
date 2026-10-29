import { BASIS_LABEL, type ParkRow } from "./types";
import { money, monthYear, monthsFromNow } from "./format";

/** One sentence a broker can say out loud before dialing. Built only from fields already on the park. */
export function callLine(r: ParkRow): string {
  const gap = r.score_components?.refi_gap;
  const equity = typeof gap?.equity_needed === "number" ? gap.equity_needed : null;
  const months = monthsFromNow(r.maturity_date);
  if (r.loan_status === "foreclosure") return "A trustee sale or lis pendens is on the record. Ask if they want a buyer before the sale date.";
  if (months != null && months <= 12 && (r.maturity_basis === "reported" || r.maturity_basis === "document")) {
    return `The loan is documented through ${monthYear(r.maturity_date)}. Ask what they have lined up to replace it.`;
  }
  if (equity != null && equity > 0) {
    const basis = String(gap?.noi_basis ?? "");
    const on = basis.startsWith("reported") ? " on their reported income" : " on an estimate of their income";
    return `Refinancing at today's rate looks short about ${money(equity)}${on}. Ask whether they would rather bring cash or sell.`;
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
    const hot = (r.score ?? 0) >= 40 || (months != null && months <= 12) || r.loan_status === "foreclosure";
    if (!hot) return false;
    if (!r.last_activity_at) return true;
    return now - new Date(r.last_activity_at).getTime() > STALE_MS;
  }).slice(0, limit);
}
