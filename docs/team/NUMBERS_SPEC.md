# Numbers spec

The canonical definition of every number the app shows or scores with. The `numbers-auditor` owns this file.
- When code and spec differ, one of them is wrong. Fix the code, or record the business decision here.
- Reconciled with the code on 2026-11-11, then updated for the acquisitions-lead's decisions the same day.
- The seller's coverage test uses a 25-year amortization. The underwriting desk's own loan stays 30 years.
- Owner pressure uses a reported NOI only. A statewide rent, a typed lot rent, or a 40% expense ratio does not fill a blank park.
- A numeric 0 is a real value. Missing stays missing.
- There is one acquisition fit score: size 25, state 20, kind 15, rate 20, distance 20.
- A fully amortizing loan scores 0 maturity points. A stated maturity that has already passed scores 35.
- Equity on the desk is price minus the new loan, labeled before closing costs. The 5-year IRR uses year-5 NOI and no selling costs, labeled before selling costs. The refinance rate stays the 5-year Treasury plus a spread. The cash gap uses the balance on file, not a projected balance at maturity.

## Conventions

| Item | Convention |
|---|---|
| Rates | Annual percent in storage and on screen (`6.85%`); decimal only inside calculations |
| Rate changes | Basis points (`+265 bps`). `format.bps` multiplies a percent-point difference by 100 and rounds |
| Payments | Monthly compounding, level payment unless the loan is interest-only |
| Money | Dollars. Annual figures are labeled "/ yr". Never mix monthly and annual in one formula without converting |
| Dates | Maturity at month precision unless the source gives a day. The score's month count ignores the day of the month |
| Missing values | Missing stays missing (`—`), never 0. A formula with a missing input returns missing and says which input was missing |
| Provenance | Every output inherits the weakest provenance among its inputs: `assumed` < `estimated` < `document` < `reported` |

A numeric 0 is kept. `scoring.py` and `jobs.py` test `is not None` for the note rate, NOI, original amount, and current balance. `noi_with_basis` keeps a 0 rent, a 0 occupancy, and 0 rentable sites.

## Constants

These live at the top of `scoring.py` and are repeated in `underwrite.py` / `web/lib/underwrite.ts` for the loan-sizing trio.

| Name | Value | Where it is used |
|---|---|---|
| Lot rent by state | AZ 700, TX 600, FL 800, CA 1000, CO 850, NV 750, NM 550, UT 700, ND 550, any other state 650 | Not used as a park's NOI. The constant remains in `scoring.py` and is not a score input |
| RV site revenue | $450 / site / month | Not used as a park's NOI |
| Occupancy default | 90% | Visible default on the underwriting desk only. Not used in owner pressure |
| Expense ratio default | 40% | Visible default on the underwriting desk only. Not used in owner pressure |
| Refi LTV cap | 75% | Applied only when a saved price is greater than 0 and a reported NOI exists. Label: "75% of price (desk cap)" |
| Seller amortization | 25 years | The coverage score and the seller's maximum new loan, including when the existing loan is interest-only |
| Desk amortization | 30 years | Our own loan in `underwrite.py` and `web/lib/underwrite.ts`. Label: "30-year desk loan" |
| DSCR test | 1.25x | Sizing the maximum new loan. Label: "1.25x DSCR" |
| Seller-finance floor | 5% | `individual` loans only, after Treasury plus spread |
| Measured-spread sample | 8 loans | Below this, the assumed spread table is used |

Assumed spreads over the 5-year Treasury, in percentage points: community bank 2.75, regional 2.50, national 2.25, credit union 2.75, agency 1.80, CMBS and conduit 2.25, life company 1.70, debt fund 4.00, SBA 2.75, individual 2.00, government 1.00, unknown 2.50.

## Loan math

Notation: r = annual rate ÷ 100 ÷ 12, n = amortization months, P = principal. `payment_months` in `scoring.py`. The two textbook arrangements (discount form and annuity form) agree to the cent on the golden cases.

| Quantity | Definition |
|---|---|
| Monthly payment (amortizing) | P × r ÷ (1 − (1 + r)^−n), for n > 0 and r ≠ 0 |
| Monthly payment (interest-only) | P × r. The code takes this branch when n ≤ 0 |
| Monthly payment at 0% | P ÷ n, when n > 0 |
| Interest-only at 0% | 0 |
| Balance after k payments | For n ≤ 0, the balance stays P. Otherwise k is capped at n. At 0%, P × (1 − k / n). Otherwise P × (1 + r)^k − payment × ((1 + r)^k − 1) ÷ r, floored at 0 |
| Annual debt service | 12 × monthly payment |
| Loan constant | Annual debt service on $1 of principal |
| Fully amortizing | See the maturity section. The balance formula itself does reach about 0 at month n |

`web/lib/underwrite.ts` `paymentMonths` matches Python, including interest-only when the term is 0 months. The acquisition screen calls the 30-year form for our loan.

## Refinance and sizing

Today's refi rate, from `RateCurve.loan_rate`, is `round(5-year Treasury for that month + spread, 2)`. The spread is the measured median for that lender type when the sample has at least 8 loans, and the assumed table otherwise. An `individual` loan is then raised to the 5% floor. The screen shows the rate, the spread, and whether the spread is measured or assumed.

DISPUTED: the original definition asked for a matching-term Treasury or SOFR. The score always uses the 5-year Treasury. `spreads.tenor_for_term` is not consulted by `loan_rate`.

| Quantity | What the code does |
|---|---|
| Rate shock | Today's refi rate minus the note rate, in percentage points. Points = 20 × clamp(shock / 3, 0, 1), so a shock of +3.0 points (+300 bps) scores 20 and a lower rate scores 0. The result is rounded to 0.1 |
| When the coupon is missing | The coupon is estimated as the refi rate on the origination date, and the basis is `estimated` |
| Max new loan, before a price | max(0, balance × (DSCR ÷ 1.25)). On a positive NOI this equals NOI ÷ (1.25 × loan constant at today's rate and 25 years). A negative NOI sizes a loan of 0, so the cash gap stops at the balance |
| Max new loan, with a saved price | The lesser of that amount and 75% of the saved price. With no saved price the LTV cap is not applied, and the component says so |
| Cash the owner must bring | max(0, balance − max new loan), rounded to the nearest dollar |
| DSCR at today's rate | Reported NOI ÷ annual debt service on the balance at today's refi rate, amortized over 25 years. Rounded to 0.01 for display. The points use the unrounded ratio. No reported NOI: the line is not scored |
| Refinance-gap points | 20 × clamp((1.40 − DSCR) / 0.55, 0, 1), rounded to 0.1. Full points at DSCR 0.85 or below. Zero points at DSCR 1.40 or above. At 1.25x the points are 5.5. The dollar gap does not move the points |

The balance in that formula is the reported current balance when one is stored. Otherwise the score amortizes the original amount from the start month to the as-of month and marks the basis `estimated`. Interest-only keeps the original amount. A missing amortizing term uses 300 months. The day of the month is ignored. The Balance on screen, and the cash line, use a reported current balance only. An estimated balance stays off those lines.

The dollar gap uses today's balance. A negative NOI sizes a loan of 0, so the gap stops at the balance. When a saved price is what caps the new loan, the call line says so. It does not call that gap a shortfall in reported income.

An interest-only loan is still tested as a new 25-year amortizing loan. The line says "25-year bank amortization," so the interest-only payment is not the payment in the test.

## NOI

`noi_with_basis` does not invent income. A missing site count, lot rent, occupancy, or expense ratio returns no NOI and names the missing input. Zero rent, zero occupancy, or zero rentable sites returns 0. The coverage score does not call this helper. It uses `loan.noi` when that value is not null, including 0, and labels it `reported`.

The call line quotes a cash gap only when the NOI basis is exactly `reported`. A worked seller test, all reported, is in `test_seller_coverage_worked_example`: $5,000,000 at 7% for 25 years pays $35,338.96 a month, DSCR on $450,000 is 1.06x, coverage is 12.3 of 20, and the cash gap is $755,393.

`underwrite.noi` and the TypeScript scenario use the same product, with the expense ratio the user typed. They do not fill a missing input. `operating.occupancy` (Python and TypeScript) agree: a stated occupancy percent is divided by 100, and otherwise occupied rentable sites ÷ rentable sites, clamped to [0, 1]. A stated 0% stays 0. Rentable sites are total sites minus sites under development.

Leased land is stored and shown. It is not an input to NOI or to either score. There is no leased-land score.

## Underwriting

`underwrite.scenario` and `web/lib/underwrite.ts` `scenario` returned the same NOI, loan, equity, cash-on-cash, IRR, and exit value on all four golden cases, including a 0% coupon. Python also returns the exit balance; the TypeScript balance function matches it when the new loan is 30-year. A typed rate of 0% runs. The golden 0% case is 67.76% cash-on-cash and 90.96% IRR. Equity is labeled "before closing costs." The IRR is labeled "before selling costs."

| Quantity | What the code does |
|---|---|
| NOI | sites × lot rent × 12 × occupancy × (1 − expense ratio), from the typed inputs |
| Cap rate on screen | The cap the user typed. In-place cap, NOI ÷ price, is not shown. On the first golden case those are 22.68% and 8% |
| Price per site | price ÷ sites, on the assessor sale and the sale list. There is no separate function |
| Loan | The lower of 75% of price and NOI ÷ (1.25 × 30-year loan constant). The binding constraint is named `ltv` or `dscr`. Equal constraints are named `ltv` |
| Equity | price − loan |
| Cash-on-cash | (NOI − year-1 debt service) ÷ equity, in percent, rounded to 0.01. NOI here is not grown |
| Debt yield | Not computed |
| 5-year IRR | Newton on [−equity, then for each year t = 1..5: NOI × (1 + growth)^t − debt service]. In year 5 the sale is added: NOI × (1 + growth)^5 ÷ (typed cap ÷ 100) − the remaining 30-year balance. Result in percent, rounded to 0.01. `None` when the flows do not change sign or Newton fails. A known flow [−100, 0, 121] returns 10.00 |
| Walk-away price | Not computed |

Equity is price minus the new loan. Closing costs were left out of this audit; the label says "before closing costs."

The sale uses year-5 NOI at the typed cap and subtracts no selling costs. The label says "before selling costs."

The year-1 cash flow inside the IRR is already grown. Cash-on-cash is not. On the golden case with 3% growth those year-1 cash flows are $51,612 and $44,880.

"Assume the note" on the acquisition screen sizes a new 30-year loan at the typed rate. It does not take the existing balance or an interest-only payment.

## Scores

### Owner pressure (0–100)

The total is the sum of the scored parts, capped at 100, rounded to 0.1. The park page shows that same tenth, so the parts add up to the total. A part that was not scored is "—", and it is not added as 0. A park with no loan has no total.

| Part | Max | Formula |
|---|---:|---|
| Maturity | 35 | 35 × clamp(0.55 × prob_12m + 0.30 × prob_24m + 0.15 × prob_past_due, 0, 1), rounded to 0.1. A foreclosure status scores 35 and ignores the estimate |
| Rate shock | 20 | See above. A missing start date scores 0 even when a note rate is stored |
| Refinance gap | 20 | The DSCR scale above, not the dollar gap |
| Lender | 10 | CRE concentration at least 300% of capital: +6. At least 200%: +3. Community bank or debt fund: +2. A payment status other than empty, `0`, `A`, or `B`: +8. Capped at 10 |
| Owner | 15 | Years held = days ÷ 365.25. At least 15 years: +5. At least 8: +3. Owner state differs from the park state: +3. Individual or trust: +4. Exactly one park: +3. Capped at 15 |

A document maturity inside 12 months has probabilities 1, 1, and 0, so the maturity part is 29.8, not 35. The three weights sum to 1 only when the loan is also past due. Full maturity points before foreclosure are reserved for a past-due loan that is still open.

DISPUTED: those weights are applied to overlapping probabilities, so a certain maturity inside 12 months cannot score 35.

A fully amortizing loan scores 0 maturity points and the line reads "Fully amortizing — no balloon." A document or reported maturity date that is already past scores 35 and reads "Maturity date has passed." The 0.15 factor remains on the stored probability; it does not move the points.

The score job does not store that flag. On a reload it is true when the balloon flag is false, when the amortization is no longer than the term, or when the stored explanation already contains "Fully amortizing — no balloon." A term of 180 months or more does not, by itself, turn a stated balloon into a paid-off loan. A known term with no stated date still uses that 180-month rule inside `estimate` and writes the sentence.

### Acquisition fit (0–100)

One function scores fit. `acquisition_fit` in Python and `acquisitionFit` in `web/lib/fit.ts` use the same weights. The park page shows that score once. Default box: 50–400 sites, Arizona, kinds `mhp`, `rv`, `mixed`. A blank flood zone adds nothing. Years held stay on owner pressure.

| Part | Max | Rule |
|---|---:|---|
| Size | 25 | Site count inside the box. A missing count scores 0 and says the count is unknown |
| State | 20 | State is in the box |
| Kind | 15 | Kind is in the box |
| Rate | 20 | Note rate is at least 0.50 point below today's rate. A missing rate scores 0 |
| Distance | 20 | Within 40 km of a managed park. A missing distance scores 0. The sentence converts kilometers to miles with ÷ 1.609 |

A fictional 120-site Arizona MHC with a 4% note against a 7% market rate and no distance scores 80. The same park in Nevada scores 60. An unknown site count on the Arizona park scores 55.

`fitScore` on the park page calls `acquisitionFit`. The header and the "Why the fit score is …" list are that one score. The call tier still treats 55 or more as inside the box. A missing site count scores 0 and reads "Site count is unknown."

## Maturity estimates

- A reported or document date uses `exact`. It is not blended with a term prior. p10 = p50 = p90 = that date.
- `prob_12m` and `prob_24m` use the difference in calendar months, not days. A date 12 months ahead on the calendar counts, even when it is more than 366 days away. 30 Nov 2027 is 12 calendar months and 384 days after 11 Nov 2026, and `exact` sets `prob_12m` to 1.
- A past date that is still on a CMBS or agency servicer report stays fully open. Any other past date is scaled by 0.60 within 6 months, 0.35 within 18 months, and 0.15 after that.
- A loan with no stated date uses `estimate`. Candidate terms come from `TERM_PRIORS`, or from the extension prior when a later modification is recorded. A known term becomes a single date and is labeled estimated.
- Weights of terms that are already past are multiplied by the still-open factors and are not scaled back up to 1. The lost weight is the chance the loan was already repaid.
- Only terms shorter than 180 months enter the probabilities. A longer term is treated as fully amortizing and adds nothing to `prob_12m`, `prob_24m`, or `prob_past_due`.
- The estimate's 12-month and 24-month windows are 366 days and 731 days, which is not the calendar-month test `exact` uses.
- Probabilities from `estimate` are rounded to three decimals. p10 ≤ p50 ≤ p90 on the golden priors.
- An SBA loan with no stated term lands on a 300-month date. That term is balloon-free, so the probabilities are 0. The explanation says "Fully amortizing — no balloon" and names the date the term ends. It does not say the chance within 24 months is 0%.

## Golden parks

`pipeline/tests/fixtures/golden_parks.json` holds the fictional inputs and the hand-checked outputs. `pipeline/tests/test_golden.py` checks payments, balances, NOI, maturity probabilities, score parts and totals, the acquisition scenario, and the Python fit. `web/lib/golden.test.ts` reads the same file for the TypeScript payment, balance, scenario, and fit.

Park ids: `mesquite-balloon`, `ironwood-io`, `saguaro-sba`, `redrock-past`, `canyon-cmbs`, `ocotillo-rv`, `clearwater-free`, `blank-slate`, `priced-but-covered`, `ceiling-foreclosure`, `seller-floor`, `mixed-market-rent`.
