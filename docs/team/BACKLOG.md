# Backlog

Ranked work for the team. Wrong numbers and broken workflows first, then by value to a buy decision, then by lowest effort. The developer keeps this current.

**Status values:** `open`, `in progress`, `blocked: <reason>`, `done`, `cut`.

**Owner values:**
- `dev`: the developer
- `acq`: the acquisitions-lead
- `data`: the data-scout
- `num`: the numbers-auditor
- `rev`: the code-reviewer

| # | Item | Why it matters | Owner | From | Status |
|---|---|---|---|---|---|
| 1 | Nightly park upsert dies on a blank phone or website. Bind every park column on insert, including blanks, so the park is stored and the rest of the file still loads. | A missing contact field rolls back the open batch and stops the HIFLD and operating imports | dev | acquisitions-lead | done |
| 2 | Numbers audit: reconcile `NUMBERS_SPEC.md` with the code. Build the golden parks with hand-checked outputs, add pytest and Vitest tests, and check that the Python and TypeScript formulas agree. | Wrong numbers are the most expensive defect, and the formulas live in two languages | num → dev | team setup | done |
| 3 | Baseline review of the riskiest code: nightly jobs and field locks, RLS on every table, API routes, AI write paths | Catches existing defects before new work builds on them | rev → dev | team setup | done |
| 4 | E2E harness: Playwright in `web/e2e/` running the core workflow in demo mode, plus a CI job | Every later change needs a regression check | dev + acq | team setup | done |
| 5 | First walkthrough and feature audit: the acquisitions-lead runs the core workflow (money math by hand, edge cases, phone width) and puts every shipped screen through the value test. Each is marked keep, simplify, cut or improve; cuts go to the user. | Baseline of what blocks daily use, and what's clutter | acq → dev | user | done |
| 6 | Recorder distress sweep by document code and date for Maricopa (trustee's sale notices, lis pendens, releases, assignments), matched to parks | Post-purchase distress is almost entirely missing. It is the strongest seller signal. | data → dev | AUDIT.md | open |
| 7 | Fix CMBS loans with a null maturity (parse gap or truly absent; prove it with a fixture) | Reported dates are the most trustworthy facts we have | data → dev | AUDIT.md | open |
| 8 | Labeled accuracy set: 20+ hand-checked parks per county (APN, owner, loan, maturity), plus a match-rate report | Without it, every accuracy claim is an opinion | data | DATA_PLAYBOOK | open |
| 9 | Maturity holdout and calibration: hide known CMBS/SBA maturities, estimate them, report p10–p90 coverage | County-loan maturities drive the score and are wide | data + num → dev | AUDIT.md | open |
| 10 | Pima recorder (verify API or bulk access), then Pinal parcels and use codes | Pima is 26% of parks with no loan documents | data | COVERAGE.md | open |
| 11 | Treasurer tax delinquency and lien lists (Maricopa, Pima, Pinal), matched to parks | Cheap, strong distress signal | data → dev | DATA_PLAYBOOK | open |
| 12 | FFIEC call reports: bank CRE concentration and noncurrent loans by lender, as a lender-stress input | Most park debt is bank debt we can't see. Lender stress is a proxy. | data | DATA_PLAYBOOK | open |
| 13 | Show a published Arizona average lot rent beside an entered rent, and never use it as that park's NOI. The acquisitions-lead cited $795 a month, Northmarq, Q2 2026. That figure is not verified. | A comp next to the rent the owner charges, without inventing income | data | acquisitions-lead | open |
| 14 | Flag a loan that can be assumed, separate from the fit score's rate points. | An assumable note is a different reason to call than a cheap coupon | dev | acquisitions-lead | open |
| 15 | Show the seller's cash at a chosen price after the loan is paid off. | The equity check at the table, beside the refinance gap | dev | acquisitions-lead | open |
| 16 | Later: a demo-only spec that logs a call, sets a follow-up, and moves a stage. It never runs against the live project. | The read harness has to be green first | acq | acquisitions-lead | open |
| 17 | Later: the owner's other parks, after a desk pass names an owner with more than one park and reads the empty state. | The 13 Nov 2026 walk did that pass. See item 18. Do not build a second screen. | acq | acquisitions-lead | open |
| 18 | The call line has to match the maturity note. A date that has already passed, a range that has already passed, or a note that says the loan was most likely repaid, cannot be written as a future refinance ask. | This is the sentence read before the call. Silver Spur Village and Canyon Village in the 13 Nov 2026 demo walk. | dev | acquisitions-lead | done |
| 19 | On the owners list and the dossier, show other parks that carry the same recorded name, labeled as the same name and not a confirmed identity. A blank balance stays blank. It must not print as $0. | Silver Spur Holdings LLC is two owner records and the dossier said 1 park and Debt on file $0. | dev | acquisitions-lead | done |
| 20 | The stage control shows "Not in the pipeline" until a stage is saved. It must not default to Target. | Every park that was not already a deal looked like it was in Target. The board had one card. | dev | acquisitions-lead | done |
| 21 | Owner letters do not say "you have held about N years." A maturity date appears only on the Maturity template, and only when the date is documented or reported. | First-contact drafts quoted a reported date and an estimated hold. The Maturity template already withholds an estimated date. | dev | acquisitions-lead | open |
| 22 | The prospects rate-shock cell says the coupon is estimated, or stays blank, when the note rate was not on the loan. | Silver Spur RV Resort showed +85 bps with a blank note rate. The park page says 7.00% is estimated. | dev | acquisitions-lead | open |
| 23 | On the owner dossier, an estimated maturity is labeled estimated, and a date that has already passed is not called the next maturity. | The dossier takes the earliest date on the overview and prints it as "Next maturity" with no basis. Pre-existing. Left out of the blank-balance fix because that sentence was locked as "Next maturity {month}". | dev | code-reviewer | done |
| 24 | The call line says documented only when the maturity is from a document. A reported maturity says reported. | Silver Spur Manufactured Home Community says "The loan is documented through Sep 2027" while the loan block says the date was reported by the lender, 2027-09-08. Golden Sun already says reported. | dev | acquisitions-lead | done |
| 25 | On the park, a passed date is labeled Passed. A park with no loan says No loan found. | The dossier already does this. Silver Spur Village and Canyon Village still head the tile Next maturity. | dev | acquisitions-lead | in progress |
| 26 | A call line that is only a hold phrase says the loan fact. No loan says no loan is on file. | Paradise Manufactured Home Community and Mountain View MHP in Tucson. Owner letters stay item 21. | dev | acquisitions-lead | in progress |
| 27 | A distress row and a sale row name the park and link to it. | The distress cell said Linked and was not a link. The sale row stopped at the parcel. | dev | acquisitions-lead | in progress |
| 28 | A community-bank note is not tagged cmbs. The filing line says County record. | Golden Sun, Silver Spur Manufactured Home Community, and Saguaro said Loan: cmbs and Type: Community bank. The data scout said the type is the loan. | data → dev | acquisitions-lead | in progress |
| 29 | Remove This week. The calls already sit on Today, and passed dates were counted as call targets. | Cut in the 16 Nov 2026 audit. The user asked for the recommended cuts. | dev | acquisitions-lead | open |
| 30 | Remove /freshness, the Admin link Data sources, and the Data issues link Source freshness. | Cut in the 13 Nov and 16 Nov audits. One raw JSON row. The rate desk already has the as-of date. | dev | acquisitions-lead | open |
| 31 | Later: the 16 Nov simplifications. Today drops the repeated call blocks. Prospects drops the lists above the table and opens the park from the row. The rate desk drops blank day and year changes and Shelter CPI. Admin drops the Rate desk and Buy box links. Help drops the repeated Honest limits block. Signals hides FHA, Form D, and Filings until a row names a park. Onboarding drops the duplicated steps. | Approved as simplify. Not in the three items with acceptance criteria. | dev | acquisitions-lead | open |

## Item 23, locked 16 Nov 2026

Approved. Build only the criteria below. Clock 2026-11-12. A month has passed when the year and month are before the clock. The current month has not.

- Golden Sun's owner: "Next maturity May 2028. Reported." Tile Next maturity, value May 2028, line Reported. Park row "matures May 2028 · Reported".
- Silver Spur RV Resort's owner: "Next maturity Sep 2027. From document."
- Canyon Mobile Home Park's owner: "Next maturity Jan 2027. Estimated. Likely range Jan 2026 to Jan 2029."
- Golden Sun Village's owner: "Next maturity Nov 2029. Estimated. Likely range Nov 2027 to Nov 2034."
- Canyon Village's owner: "No maturity still ahead. Estimated range Sep 2023 to Sep 2026 has already passed." Tile Passed, value Sep 2026. Park row "Estimated range Sep 2023 to Sep 2026 has passed".
- Silver Spur Village's owner: "No maturity still ahead. Jul 2022 has passed. From document." Tile Passed. A passed reported date uses the same shape with Reported.
- Canyon Estates' owner: "No maturity on file." Tile Next maturity, value —. Park row "no maturity on file".
- If the estimated point month has passed and the range end has not: "The {point} point date has passed. Estimated. Likely range {start} to {end}." Tile Estimated range.
- A date with no basis says Basis unknown. The dossier does not say documented, and it does not say the loan was most likely repaid.
- When one month is still ahead, a passed month does not take the Next maturity line.

## Item 28, locked 16 Nov 2026

Approved. The data scout's answer. Build only the criteria below. Do not change the maturity basis, the lender type, the balance, or the score.

- Golden Sun, Silver Spur Manufactured Home Community, and Saguaro show Loan: County record and Type: Community bank. The words cmbs and CMBS are not on that loan card or in the Debt source cell.
- The same correction covers every demo loan whose source was cmbs and whose lender is not a CMBS trust. There were 12.
- A real CMBS filing still says CMBS filing. This demo book has none.
- `make_demo.py` writes county for a known date unless the lender kind is a CMBS trust.

## Item 27, locked 16 Nov 2026

Approved. Build only the criteria below.

- The distress row for the trustee sale notice recorded 2026-10-12 names Paradise RV Resort, and that name links to the park. The cell is not the word Linked.
- The sales row names Paradise RV Resort and links to the park. The parcel, date, price, and owner stay on the row.

## Item 26, locked 16 Nov 2026

Approved. Build only the criteria below. Owner letters stay item 21.

- Paradise Manufactured Home Community, no loan: Before you call says "No loan is on file." It does not say "held about."
- Mountain View MHP in Tucson, reported 2028-07-03, whose owner line is only "held about 24 years": "The loan is reported to come due Jul 2028."
- An owner line that also names a state or an entity stays as it is. Golden Sun's twelve-month and eighteen-month sentences stay as they are.

## Item 25, locked 16 Nov 2026

Approved. Build only the criteria below. Clock 2026-11-12. The call lines on these parks stay as they are.

- Silver Spur Village: tile label Passed, value Jul 2022, line From document. Next maturity is not the tile label.
- Canyon Village: tile label Passed, value Sep 2026, line "Estimated · Sep 2023 to Sep 2026." Next maturity is not the tile label.
- Golden Sun stays Next maturity, May 2028, Reported. Silver Spur RV Resort stays Next maturity, Sep 2027, From document.
- Paradise Manufactured Home Community says No loan found. It does not say Next maturity with a month.

## Item 24, locked 16 Nov 2026

Approved. Build only the criteria below.

- Clock 2026-11-12. Silver Spur Manufactured Home Community, maturity 2027-09-08, basis reported, says exactly: "The loan is reported to come due Sep 2027. Ask what they have lined up to replace it."
- Silver Spur RV Resort, maturity 2027-09-25, basis document, keeps: "The loan is documented through Sep 2027. Ask what they have lined up to replace it."
- Golden Sun, maturity 2028-05-12, basis reported, keeps: "The loan is reported to come due May 2028. Confirm the real date and whether they want to hold."
- A passed date and a foreclosure stay on their current sentences. Estimated, unknown, and a blank basis do not get either of the twelve-month sentences.
- Owner letters stay item 21.

## Item 20, locked 13 Nov 2026

Approved. Build only the criteria below. The full wording is the acquisitions-lead's return for this item; the playbook line is the rule.

- Empty Stage label: **Not in the pipeline**. It is not a choice after a stage is saved, and choosing it does not remove the deal.
- A Next action date before a stage does not create a Target. The field keeps the date and the line says **Pick a stage to save the next action.**
- Choosing Target on a park that was not in the pipeline is a real save and puts that park on the board.
- Demo board: Paradise RV Resort stays the Contacted card. Golden Sun, Silver Spur RV Resort, and Saguaro have no card until a stage is saved.
- Prospects **Add to pipeline**, Dead, Mark managed, and the board's empty sentence stay as they are.
