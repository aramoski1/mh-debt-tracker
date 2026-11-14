# Test log

Newest first. Written by the acquisitions-lead. Each session lists: date, what was tested and with which data, pass/fail per acceptance criterion, and defects with severity, steps to reproduce, expected vs actual, and a screenshot path.

## 2026-11-13 — Demo browser harness

Branch `team/e2e-harness`, not committed. Demo data only. From `web/`, I ran `npm run e2e` (`playwright test`). Playwright started its own server and the suite finished **6 passed (42.9s)**. Before the run, nothing was listening on port 3000 or port 3100. I did not sign in, did not open the signed-in app, did not click Save case, did not write the database, and did not run a migration.

**Data.** The runner's server is demo mode on http://127.0.0.1:3100, with the desk clock set to 2026-11-12. The log line `[WebServer]` is that server. The pages loaded the demo parks with no sign-in wall. Today's calendar date is 2026-11-13. The call sentences count months, so Nov 13 says the same thing as Nov 12. The pin is what holds those sentences when the month changes. The figures below are the same ones I hand-checked on 2026-11-11.

**Verdict: ship.**

### Acceptance criteria

1. **Pass.** From `web/`, `npm run e2e` starts its own demo server and exits 0. All 6 tests passed. Ports 3000 and 3100 were free beforehand, and the pages came from the server Playwright started, in demo mode, on port 3100, with the clock set to 2026-11-12.
2. **Pass.** "today lists Golden Sun, and that park's loan is the reported May 2028 note" (9.1s). Today lists Golden Sun Mobile Home Park linking to `/parks/4afc56da-ea0a-4cf9-b433-d7696eabeed1`. The park shows Commerce Bank of Arizona, Balance $2.5M, Rate 3.56%, Payment —, and "The loan is reported to come due May 2028."
3. **Pass.** "Silver Spur shows one fit of 60 and owner pressure 45.5, with no cash gap" (3.1s). One Acquisition fit of 60. Owner pressure 45.5 High. Parts 29.8/35, 5.7/20, coverage blank, 2.0/10, 8.0/15. Fit parts 25, 20, 15, 0, 0. Balance blank. No "Cash the owner must bring". Call line exactly "The loan is documented through Sep 2027. Ask what they have lined up to replace it."
4. **Pass.** "Saguaro leaves the payment blank" (2.0s). Balance $1.1M, Rate 4.91%, Payment —.
5. **Pass.** "Paradise has no loan score and one fit of 60" (1.8s). Heading "Not scored — no loan on file." No score. One fit of 60. Five parts blank.
6. **Pass.** "Saguaro underwriting stays unsaved and matches the desk case" (2.3s). Unsaved inputs: Price 6000000, Cap 7.5, Sites 100, Lot rent 375, Occupancy 100, Expenses 0, Rent growth 0, New bank loan 7. Tiles: cash-on-cash 6.05%, equity $1,500,000, IRR 8.99%. The draft has the year-1 NOI $450,000 sentence, the 30-year desk loan at 7.00% for $4,500,000 with 75% of price binding, cash-on-cash 6.05%, equity before closing costs, and year-5 IRR 8.99% at a 7.5% cap. The draft does not mention 4.91% or the existing balance. Clearing the bank rate to 0 keeps a draft at 0.00% and $4,500,000, and cash-on-cash 20.00%.
7. **Pass.** "Golden Sun underwriting uses the figures left on the form" (2.2s). Unsaved inputs: Price 4000000, Cap 8, Lot rent 400, Rent growth 2, New bank loan 7, leaving sites, occupancy, and expenses. The draft contains $4,000,000, "80 sites, $400 lot rent, 90% occupancy and 40% expenses, year-1 NOI is $207,360", and a 30-year desk loan at 7.00%.
8. **Pass.** The Golden Sun loan spec and both underwriting specs assert no POST to `/api/underwriting` and zero "Saved on this park." All three passed. I did not click Save case.

### Defects

None that fail a criterion.

Dev-server noise, not a fail: Next printed "Cross origin request detected from 127.0.0.1 to /_next/* resource." The six tests still passed. The known nav hydration warning did not appear in this run's output. Logging a call, a follow-up, a stage change, and an owner page stay Later (backlog 16 and 17).

### Screenshots

None. The suite ran headless. I did not open the demo in a browser.

### Backlog added

None.

## 2026-11-12 — Blank phone and website on park insert

Branch `team/blank-park-upsert`, commits `5ccbe50` and `b5bba9e`, off `504e911`. Live desk at http://localhost:3000 (Supabase from `web/.env.local`). No case saved, no note, no stage change, no database write.

**Data.** Pipeline unit tests already run on this commit: 74 passed, 2 skipped (`test_full_pipeline`, `test_import_matches_parks_and_feeds_score`). Both skipped tests need Postgres, which this machine does not have. They are the tests that execute the insert. Desk check used the running app only as far as the sign-in wall.

**Verdict: ship.** Merge still waits on those two Postgres tests going green in CI. I am accepting the unit tests that ran, plus the database test CI must still run. I did not see a row inserted.

### Acceptance criteria

1. **Pass.** A new park with a name and address and a blank phone and website is inserted once, phone and website are null, and the run continues. Accepting `test_new_park_insert_binds_every_blank_column` (ran: phone and website bind as null and are not tagged) and `test_full_pipeline` (skipped here; it loads the HIFLD fixture, asserts park `1001` has null phone and website, and asserts three Arizona parks). CI must still run that database test. I could not see the insert on the screen.
2. **Pass.** The same source id on a second run updates that park and does not insert a duplicate. Accepting the second `ingest_hifld` in `test_full_pipeline`, which asserts the park count stays 3. That test was skipped here and must run in CI. `test_second_run_keeps_name_norm_when_the_name_normalizes_empty` did run: a name such as "LLC" keeps the stored normalized name.
3. **Pass.** A later blank does not clear a phone or website already on the park. `test_blank_phone_does_not_clear_a_stored_phone` ran and passed. A blank is ignored in the merge, so the stored phone `480-555-0100` and website stay, with their tags. The skipped database test does not assert this case. The merge test is the one that covers it, and it ran.
4. **Pass.** A new park missing another nullable park column still binds that column as null. The same unit test binds every park column and asserts units, lat, and county are null. Lon, zip, status, and city are on that same list and were omitted from the sample, so they bind as null the same way. Address was present in the sample, so a missing address is the same bind and is not a separate assertion. State and kind are not nullable; a missing state is stored as an empty string and a missing kind as `unknown`. The database test must still run before anyone treats the insert itself as proven.
5. **Pass.** No screen, label, score, or formula change. The branch diff has no files under `web/` and does not touch a score or a formula. I opened http://localhost:3000. The app redirected to `/login`. That screen is the existing sign-in form (work email, "Email me a sign-in link"). It has no new phone or website label, banner, or control. I did not open the prospects list or a park page: the live app requires a signed-in team member, and sending a sign-in link or creating an account would write auth state. I did not type in the form.

### Defects

None. The sign-in wall stopped the desk walk. That is the existing gate, not a defect in this change.

Known limit, already left open, not a fail: a row with no name still cannot be stored, because `parks.name` is not null. I would not store a nameless park. A park I cannot name is not a park I can call.

### Screenshot

`docs/team/screens/blank-park-login.png` — sign-in screen after opening http://localhost:3000. Prospects and a park page were not reached.

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
