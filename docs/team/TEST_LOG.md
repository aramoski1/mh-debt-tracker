# Test log

Newest first. Written by the acquisitions-lead. Each session lists: date, what was tested and with which data, pass/fail per acceptance criterion, and defects with severity, steps to reproduce, expected vs actual, and a screenshot path.

## 2026-11-13 — Owner dossier, same recorded name

Branch `team/owner-dossier`, commits 221a310 and e137003. Demo already running at http://127.0.0.1:3010. The header said Demo data. I did not sign in, did not add a contact, did not save a paste, did not save a case, did not change a stage, and did not write the database. I did not open `/freshness`. A stored balance of $0 is not on this demo, so I did not look for a `$0` row. I did not re-run the Playwright suite. The spec `a blank owner balance stays blank, and the same recorded name stays a separate park` is already in `web/e2e/core-workflow.spec.ts`.

**Verdict: ship.**

### Acceptance criteria

1. **Pass.** `/owners/eb4c1318-4fd1-45b3-97b9-79167ceb859e`, Silver Spur Holdings LLC. Header: "Los Angeles, CO · llc · 1 park in this desk." Sentence: "Recorded debt on the book is —." Parks `1`. Sites `260`. Debt on file `—`. No `$0`. Section headed "Same recorded name" lists Silver Spur Manufactured Home Community, with the line "Not a confirmed owner." That row has no dollar amount. The link opened `/parks/91e245d4-a308-47af-9f9d-6335b8c6fd53`, heading "Silver Spur Manufactured Home Community", "Lake Havasu City, AZ", 120 sites. The owner link on that park goes to `/owners/e29d7cdb-38b1-4575-be59-1772d789a260`, not back to a merged dossier. Screenshot `docs/team/screens/owner-dossier-silver-spur-rv.png`.
2. **Pass.** `/owners/e29d7cdb-38b1-4575-be59-1772d789a260`. "Los Angeles, CA · llc · 1 park in this desk." Parks `1`. Sites `120`. Debt on file `$3.2M`. Sentence: "Recorded debt on the book is $3.2M." No "balance not on file" line. "Same recorded name" lists Silver Spur RV Resort and says "Not a confirmed owner." That row has no dollar amount. The park on this record is Silver Spur Manufactured Home Community, Lake Havasu City, 120 sites. Screenshot `docs/team/screens/owner-dossier-silver-spur-mhc.png`.
3. **Pass.** `/owners/9aa03b5f-4ee5-4034-b6bd-01cb91954ed1`, Palo Verde Partners LLC. "Same recorded name" says "No other park on this desk uses this recorded name." Debt on file `$1.2M`. Sentence: "Recorded debt on the book is $1.2M."
4. **Pass.** `/owners`. Lede: "Grouped from the park list. This is the name on the record, not a beneficial-owner finding." Columns include Same name. Silver Spur Holdings LLC is two rows: CO, Parks `1`, Sites `260`, Same name "Silver Spur Manufactured Home Community"; CA, Parks `1`, Sites `120`, Same name "Silver Spur RV Resort". Three Sunrise Holdings LLC rows each say "2 other parks" (CA 210 sites, WA 120, IL 24). Palo Verde Partners LLC, Parks `1`, Sites `38`, Same name `—`. Screenshot `docs/team/screens/owners-list-same-name.png`.
5. **Pass.** `/desk`, Calls worth making, lists Golden Sun Mobile Home Park, Tucson, 45.5, "The loan is reported to come due May 2028. Confirm the real date and whether they want to hold." `/parks/c9fb0d5d-d85f-4b91-8e84-921bb3413792`: one Owner pressure `45.5` High, one Acquisition fit `60`. Before you call: "The loan is documented through Sep 2027. Ask what they have lined up to replace it." The loan block says the maturity is from the document, 2027-09-25. I did not open Underwriting and I did not click Save case.

### Defects

None that fail a criterion.

Not a fail of this item. On Silver Spur Manufactured Home Community, the sentence before the call says "The loan is documented through Sep 2027" while Next maturity says "Reported" and the note says "Maturity 2027-09-08 (reported by the lender/servicer)." Golden Sun, on the same Today list, says "reported." I would use the wrong word with the owner. Added as backlog item 24. The two Silver Spur records also disagree on the state: the RV dossier says Los Angeles, CO, and the Havasu dossier says Los Angeles, CA. The "Not a confirmed owner" line is why I do not treat that as one owner. The stage control on both park pages still shows Target. That is item 20. I did not change it.

## 2026-11-13 — Call-line fix

Branch `team/call-line`, not committed. Demo only. From `web/`, I ran `npm run e2e` (`playwright test`). Playwright started its own server and the suite finished **7 passed (1.1m)**. Ports 3000 and 3100 were free beforehand. I did not sign in, did not click Save case, did not change a stage, did not write the database, and did not run a migration.

After the suite I opened the same demo at http://127.0.0.1:3100, with `NEXT_PUBLIC_SUPABASE_URL=demo` and the desk clock set to 2026-11-12, only to read the three call lines. The header said Demo data. I did not use port 3000.

**Verdict: ship.**

### Acceptance criteria

1. **Pass.** All 7 tests passed, including the previous six. The new test is "a passed maturity is not written as a loan that is still coming due" (2.9s). The earlier six are Golden Sun's May 2028 note (9.9s), Silver Spur fit 60 and pressure 45.5 (2.0s), Saguaro's blank payment (1.6s), Paradise not scored with fit 60 (1.5s), Saguaro underwriting unsaved (2.1s), and Golden Sun underwriting unsaved (1.8s).
2. **Pass.** Silver Spur Village, `/parks/7241650e-b31c-441b-8764-9e6c3839a8d6`. Before you call reads "The Jul 2022 date has passed. The loan was most likely repaid without a recorded release." That section has no "lined up." Loan coming due is still 5.2 / 35. Owner pressure is 33.1. The score was left as it was. Screenshot `docs/team/screens/call-line-silver-spur-village.png`.
3. **Pass.** Canyon Village, `/parks/d14493f3-3dc0-4621-ba78-acf23d258f8f`. Before you call reads "The likely range, Sep 2023 to Sep 2026, has already passed. The date is a model, not a date to quote." That section has no "come due." The 74 percent stays in the score note and is not in the sentence. Screenshot `docs/team/screens/call-line-canyon-village.png`.
4. **Pass.** Silver Spur RV Resort, `/parks/c9fb0d5d-d85f-4b91-8e84-921bb3413792`. Before you call still reads "The loan is documented through Sep 2027. Ask what they have lined up to replace it." Owner pressure is still 45.5. Fit is still 60. Screenshot `docs/team/screens/call-line-silver-spur-rv.png`.
5. **Pass.** The Golden Sun loan spec and both underwriting specs assert no POST to `/api/underwriting` and zero "Saved on this park." All three passed. I did not open Underwriting in the browser and I did not click Save case.

### Defects

None that fail a criterion.

Dev-server noise, not a fail: the e2e log printed the Next.js cross-origin warning, and the browser showed a Next.js "1 Issue" badge. I did not open it. `/freshness` is still in the app. I am not asking for it to be removed.

This week uses the same sentences. The Jul 2022 repaid line and the Canyon range line each appear on `/week`. I did not treat that page as its own criterion.

### Screenshots

- `docs/team/screens/call-line-silver-spur-village.png`
- `docs/team/screens/call-line-canyon-village.png`
- `docs/team/screens/call-line-silver-spur-rv.png`

### Backlog added

None.

### Top three changes

None. Ship as built.

## 2026-11-13 — First feature audit (backlog 5)

Demo only, at http://127.0.0.1:3010. Server started from `web/` with `NEXT_PUBLIC_SUPABASE_URL=demo`, anon key `demo`, `DEMO_AS_OF` and `NEXT_PUBLIC_DEMO_AS_OF` set to 2026-11-12, dist dir `.next-walk`, port 3010. I did not sign in, did not open the live project, did not run a migration, and did not write the real database. I did not click Save case.

**Verdict: ship the audit.** The walk is done. Nothing blocked me from judging the screens. The defects below are for the desk, not for this audit.

**In-memory writes.** On Canyon Village I saved one call note, set a next-action date of 2026-11-19, and moved the stage to In conversation. The note appeared on the park as "11/13/2026 · demo@example.com · no answer · follow up 2026-11-19" and the stage control said the pipeline updated (the server logged POST 200). A later open of the board did not show Canyon Village. The dev server recompiled `/pipeline` between the save and that look, and this demo store does not survive a recompile. I am not calling the board save broken. I also did not drag a card.

### Screen marks

| Screen | Verdict | One sentence |
|---|---|---|
| `/desk` Today | simplify | Paradise RV Resort is on this page six times, and the second "do these today" row only says Contacted. |
| `/` Prospects | simplify | The morning call list is repeated above the book, and Enter opens a preview card rather than the park. |
| Park page | improve, approve | The loan block is honest, and the sentence I would read before I dial does not match the maturity note. |
| `/pipeline` | keep | One real card, empty columns say to drop a deal, and the weighted price stays blank. |
| `/follow-ups` | keep | Overdue, today, and upcoming are the right buckets. The seven-day snooze in the guide is not on this page. |
| `/week` This week | simplify | It is the same call list as Today, and loans from 2021 and 2022 are still written as if they are coming due. |
| `/owners` | improve, approve | The same recorded name is several rows, and each row says 1 park. |
| Owner dossier | improve, approve | Silver Spur Holdings LLC says 1 park and Debt on file $0, while the sentence above says the recorded debt is blank. |
| `/how-it-works` | improve, Later | Several steps describe controls I did not find, and the 34 percent / 13 percent / 2 percent line has no date. |
| `/signals` | keep | A filing shelf, and the page says the rows are the fictional demo set. |
| `/markets` | keep | County counts from the parks already loaded, and it says this is not a rent series. |
| `/rates` Rate desk | keep | The series are dated, and the page says the figures are the fictional demo set. |
| `/alerts` | keep | The rows are grouped under 2026-10-27, and snooze says it lasts until reload. |
| `/portfolio` | keep | The empty state says to mark a park managed before distance counts. |
| `/freshness` | cut | One row, the result is raw JSON, it is not in the nav, and the rate desk already shows the as-of date. |

Cuts are for the user. I am not asking for `/freshness` to be removed in this pass.

### Core workflow

1. **Pass, with a simplify.** Today lists Golden Sun. The call line is "The loan is reported to come due May 2028. Confirm the real date and whether they want to hold." The top of the page is a trustee sale at Paradise RV Resort, then the same park again as an overdue Contacted follow-up dated 2026-11-06.
2. **Pass.** Golden Sun loan: Commerce Bank of Arizona, balance $2.5M, rate 3.56%, payment blank because the amortization was not on the loan. Maturity May 2028, labeled Reported. Coverage and the cash gap stay blank. No income on file.
3. **Pass on the number, fail on the portfolio question.** Silver Spur Holdings LLC's dossier lists only Silver Spur RV Resort, 260 sites, and says 1 park. The same name is also on Silver Spur Manufactured Home Community in Lake Havasu City, under a different owner record. Debt on file reads $0. The sentence above reads "Recorded debt on the book is —."
4. **Pass, in demo memory, not confirmed on the board.** The call note saved and showed a parsed follow-up of 2026-11-19. The date field and the stage control each posted. After a server recompile the board still showed only Paradise RV Resort. See the note above.
5. **Pass.** Saguaro underwriting, unsaved. Price 6000000, cap 7.5, sites 100, lot rent 375, occupancy 100, expenses 0, growth 0, bank rate 7. Tiles: cash-on-cash 6.05%, equity $1,500,000, IRR 8.99%, DSCR 1.25x. Hand check: 100 × $375 × 12 = $450,000 NOI. 75% of $6,000,000 is $4,500,000 and that cap binds. Equity $1,500,000. The draft says year-1 NOI $450,000, a 30-year desk loan at 7.00% for $4,500,000, cash-on-cash 6.05%, and year-5 IRR 8.99% at a 7.5% cap. It does not mention 4.91% or the $1.1M balance. I did not click Save case.
6. **Pass.** The Saguaro draft is an internal review draft. It does not cite the existing loan.

### Honesty

- No owner-facing draft I opened cites an estimated balance, an estimated rate, or an estimated maturity date. On Canyon Village the Maturity draft says "I am not quoting a date, because the one on file is estimated."
- First-contact drafts do cite a documented or reported maturity (Golden Sun "The recorded maturity is 2028-05." Silver Spur RV "The recorded maturity is 2027-09.") and they cite the score phrase "You have held about N years." That hold line is an estimate written to the owner.
- Silver Spur Village, document maturity 2022-07-05: the score says "The date passed long ago; the loan was most likely repaid without a recorded release" and Loan coming due is 5.2 / 35. The call line says "The loan is documented through Jul 2022. Ask what they have lined up to replace it." This week, row 10, uses that same sentence. Rows 9 and 12 do the same for estimated dates in Jan 2022 and Mar 2021.
- Canyon Village is labeled Estimated, with a likely range of Sep 2023 to Sep 2026, and a second line that the date is a model. The call line still says the loan is estimated to come due Sep 2026. The whole range is already past the 2026-11-12 clock.
- Prospects rate shock shows +85 bps on Silver Spur RV Resort with the note rate blank. The park page says the 7.00% coupon is estimated and the note rate was not on the loan.
- Fit totals include a 0 for "No managed park is marked, so distance is not scored."
- The rent notebook line "Apache Junction: $710 / site" is on Golden Sun (Tucson), Saguaro (Yuma), and the other parks I opened. It is a desk note, and the page does not say that.
- Sale comps show "2019-06-01 · $1.8M · $75K per site · 24 sites" with no park name.
- Help states "About 34 percent of parks have an owner name. About 13 percent have any loan. About 2 percent have a reported maturity" with no as-of date. Coverage was not remeasured. The demo book does not look like those percents.
- Today and Prospects show Balance $36M with no reported/estimated word. Non-blank balances on the park pages I opened were tied to a source in the loan block. I am not calling the $36M an invented total.

### Phone and keyboard

Today at 390px wide: no horizontal overflow, the nav collapses to Menu, and the call line wraps. Screenshot `docs/team/screens/audit-today-390.png`.

On Prospects, j moved the row from Paradise RV Resort to Silver Spur Manufactured Home Community after the table itself had focus. Enter opened a preview card with "Open the full page," not the park. A Tab key from the tool did not move focus, so I did not finish a keyboard-only pass of Today.

### Edges

Reached: a park with no loan (Paradise Manufactured Home Community, not scored, fit 60, cash gap blank), an RV resort (Silver Spur RV Resort), a foreclosure that is still a notice (Paradise RV Resort), an estimated maturity whose range is already past (Canyon Village), and a document maturity the score treats as likely repaid (Silver Spur Village).

Could not reach, because the demo has no such park: two loans on one park, an interest-only loan, a park stored as leased land (the form has Owned and Leased, and every park I opened was blank), and a foreclosure that was later released.

### Defects

1. **Major.** Call line contradicts the maturity note. Silver Spur Village and This week row 10. Expected: the sentence before the call says the document date passed and the loan was most likely repaid. Actual: "Ask what they have lined up to replace it."
2. **Major.** Owner dossier turns a blank balance into $0 and hides the other park with the same name. Silver Spur Holdings LLC, `/owners/eb4c1318-4fd1-45b3-97b9-79167ceb859e`. Screenshot `docs/team/screens/audit-owner-dossier.png` shows "1 park" and "Recorded debt on the book is —." The Debt on file tile, read on the page, was $0. The same name also owns Silver Spur Manufactured Home Community.
3. **Major.** Every park I opened that is not already a deal shows Stage = Target. The board had one card, Paradise RV Resort, in Contacted. Expected: a park with no deal does not look like it is in Target.
4. **Minor.** Prospects rate-shock column prints basis points when the coupon is estimated and the note-rate cell is blank.
5. **Minor.** Distance "not scored" still contributes 0 to the fit total.
6. **Minor.** The rent notebook on a park page does not say it is not that park's rent.
7. **Polish.** Today says "1 foreclosure notices."

The known nameless-park load failure and the nav hydration warning were not part of this walk. A Next.js issues badge was on the page. I did not open it.

### Backlog added

Items 18 through 22, all `from: acquisitions-lead`. Item 17's condition is met: a desk pass named an owner with more than one park on the book and read a dossier that shows one.

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
