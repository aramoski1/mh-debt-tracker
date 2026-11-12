# Numbers spec

The canonical definition of every number the app shows or scores with. The `numbers-auditor` owns this file:
- When code and spec differ, one of them is wrong. Fix the code, or record the business decision here.
- Lines marked **(verify against code)** are standard definitions the auditor still has to reconcile with the current implementation.

## Conventions

| Item | Convention |
|---|---|
| Rates | Annual percent in storage and on screen (`6.85%`); decimal only inside calculations |
| Rate changes | Basis points (`+265 bps`) |
| Payments | Monthly compounding, level payment unless the loan is interest-only |
| Money | Dollars. Annual figures are labeled "/ yr". Never mix monthly and annual in one formula without converting. |
| Dates | Maturity at month precision unless the source gives a day |
| Missing values | Missing stays missing (`—`), never 0. A formula with a missing input returns missing and says which input was missing. |
| Provenance | Every output inherits the weakest provenance among its inputs: `assumed` < `estimated` < `document` < `reported` |

## Loan math

Notation: r = annual rate ÷ 12, n = amortization months, P = principal.

| Quantity | Definition |
|---|---|
| Monthly payment (amortizing) | P × r ÷ (1 − (1 + r)^−n) |
| Monthly payment (interest-only) | P × r |
| Monthly payment at 0% rate | P ÷ n |
| Balance after k payments | P × (1 + r)^k − payment × ((1 + r)^k − 1) ÷ r |
| Annual debt service | 12 × monthly payment |
| Loan constant | annual debt service ÷ P |
| Fully amortizing | Balance at maturity ≈ 0. There is no balloon, so no maturity pressure. |

## Refinance and sizing

| Quantity | Definition |
|---|---|
| Today's refi rate | Matching-term index (Treasury or SOFR) on the as-of date + measured spread for the lender type. Show both parts. |
| Rate shock | Today's refi rate − note rate, in bps |
| Max new loan | The lesser of LTV_max × value (only when a value or price exists) and NOI ÷ (DSCR_min × loan constant at today's refi rate and amortization). (verify against code: defaults for LTV_max, DSCR_min, amortization) |
| Refinance gap | max(0, balance at maturity − max new loan). Cash the owner must bring. |
| DSCR at today's rate | NOI ÷ (annual debt service on the current balance at today's refi rate and amortization) |
| NOI basis | Reported (e.g. CMBS NOI, annualized from partial periods), document (rent roll or T-12), entered, or assumed. Assumed today means $700 a site, 90% occupancy and a 40% expense ratio (verify against code: `scoring.py` `LOT_RENT`, `EXPENSE_RATIO`). |

## Underwriting

| Quantity | Definition |
|---|---|
| Cap rate | NOI ÷ price |
| Price per site | price ÷ total sites |
| Equity | price + closing costs + immediate capital − new loan |
| Cash-on-cash | (NOI − annual debt service) ÷ equity |
| Debt yield | NOI ÷ loan |
| 5-year IRR | IRR of: −equity at t0; annual cash flow after debt service in years 1–5; sale in year 5 at (year-6 NOI ÷ exit cap) − selling costs − loan balance |
| Walk-away price | The highest price that still meets the target return under the chosen financing scenario |

## Scores (verify against code: `scoring.py`, `web/lib/fit.ts`)

**Owner pressure (0–100)** is the sum of five capped parts:

| Part | Max points | Basis |
|---|---:|---|
| Maturity | 35 | Probability the loan is due within 12 or 24 months, or already past due. A document-stated maturity counts as certain. |
| Rate shock | 20 | Rate shock, scaled; full points at +300 bps |
| Refinance gap | 20 | DSCR at today's rate against 1.25x |
| Lender | 10 | Lender CRE concentration, CMBS delinquency or special servicing |
| Owner | 15 | Years held, out-of-state or individual owner, single-park owner |

The total must equal the sum of the displayed parts.

**Acquisition fit (0–100):** the match to the active buy box. Record each criterion and its weight here once reconciled.

## Maturity estimates

- Each estimate gives p10, p50 (likely) and p90 dates, plus `prob_12m`, `prob_24m` and `prob_past_due`.
- Probabilities lie in [0, 1], and p10 ≤ p50 ≤ p90.
- A reported or document maturity replaces the estimate; it is never blended with it.

## Golden parks

`pipeline/tests/fixtures/golden_parks.json` holds hand-checked expected outputs for the cases listed in the auditor's definition. Every formula above has at least one golden case.
