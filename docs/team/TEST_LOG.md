# Test log

Newest first. Written by the acquisitions-lead. Each session lists: date, what was tested and with which data, pass/fail per acceptance criterion, and defects with severity, steps to reproduce, expected vs actual, and a screenshot path.

## 2026-11-11 — Numbers audit, demo at http://localhost:3010

Branch `team/numbers-audit`. Demo data only. Did not save a case, did not write to a database, did not open localhost:3000. Verdict: **ship**.

Hand check on the desk case before reading the tiles: 100 sites × $375 × 12 × 100% × (1 − 0 expenses) = $450,000 year-1 NOI. At 7% and 30 years the DSCR-sized loan is about $4,509,000, so 75% of $6,000,000 ($4,500,000) binds. Debt service on that loan is about $359,263, and ($450,000 − $359,263) / $1,500,000 = 6.049%, which prints as 6.05%.

### Acceptance criteria

1. **Pass.** Silver Spur RV Resort (`/parks/c9fb0d5d-d85f-4b91-8e84-921bb3413792`). Header shows one fit, "60" / "Acquisition fit", and owner pressure "45.5" / "High". The parts read Loan coming due 29.8 / 35, Rate shock 5.7 / 20, Coverage at today's rate —, Lender pressure 2.0 / 10, Owner profile 8.0 / 15. 29.8 + 5.7 + 2.0 + 8.0 = 45.5. Call line: "The loan is documented through Sep 2027. Ask what they have lined up to replace it." No cash gap. Balance is "—". The "Why the fit score is 60" block is the breakdown of that same header score (25 + 20 + 15 + 0 + 0), not a second fit badge.
2. **Pass.** Saguaro MHP (`/parks/470e74b1-65a9-4b3c-9569-0c854cde6599`). Balance "$1.1M", Rate "4.91%", Payment "—". Note: "The amortization was not on the loan, so the payment stays blank."
3. **Pass.** Paradise Manufactured Home Community (`/parks/ad423472-c660-4094-9560-78989e6bb64c`). Header reads "—" / "No score" / "Owner pressure" and one "60" / "Acquisition fit". Heading is exactly "Not scored — no loan on file." The five parts (Loan coming due, Rate shock, Coverage at today's rate, Lender pressure, Owner profile) are each "—".
4. **Pass.** Saguaro, Underwriting, unsaved. Entered Price 6000000, Cap rate 7.5, Sites 100, Lot rent 375, Occupancy 100, Expenses 0, Rent growth 0, New bank loan 7. Tiles: Cash-on-cash 6.05%, Equity before closing costs $1,500,000, 5-year IRR before selling costs 8.99%. Letter: "year-1 NOI is $450,000." "The new bank loan case is a 30-year desk loan at 7.00%. The loan amount is $4,500,000, and 75% of price (desk cap) binds." "Cash-on-cash on those inputs is 6.05%." "Equity is price minus the new loan, before closing costs." "The year-5 IRR, before selling costs, selling at the same 7.5% cap rate, is 8.99%." Cleared the bank rate to 0. The letter then read "a 30-year desk loan at 0.00%. The loan amount is $4,500,000" and cash-on-cash 20%. It did not go blank. Did not click Save case.
5. **Pass.** From `/` opened Today (`/desk`), opened Golden Sun Mobile Home Park from Calls worth making. Loan read: Commerce Bank of Arizona, Balance $2.5M, Rate 3.56%, Payment —, "The amortization was not on the loan, so the payment stays blank." Call line: "The loan is reported to come due May 2028." Opened Underwriting and typed Price 4000000, Cap 8, Lot rent 400, Rent growth 2, bank rate 7, leaving Sites 80, Occupancy 90, Expenses 40. The draft used those figures: "$4,000,000", "80 sites, $400 lot rent, 90% occupancy and 40% expenses, year-1 NOI is $207,360", "30-year desk loan at 7.00%". Hand check of that NOI matches. No control threw. Did not save. The numbers from criteria 1–4 were on the screen.

### Defects

None that fail a criterion.

Dev-only, not a fail: a Next.js badge "1 Issue" on the park page is a hydration warning on `components/ui/Shell.tsx` line 121 (the nav Link). The nav, the tabs, and the underwriting inputs still worked, and no number went blank. It is a console warning in the dev server, not a thrown control on the desk.

### Screenshots

- `docs/team/screens/silver-spur-score.png` — Silver Spur, 45.5 breakdown, 29.8 and 5.7, documented maturity.
- `docs/team/screens/paradise-no-loan.png` — "Not scored — no loan on file." and blank parts.
- `docs/team/screens/silver-spur-overview.png` — Silver Spur header, demo badge.

### Backlog added

None.

