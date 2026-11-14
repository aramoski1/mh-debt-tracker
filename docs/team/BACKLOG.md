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
| 19 | On the owners list and the dossier, show other parks that carry the same recorded name, labeled as the same name and not a confirmed identity. A blank balance stays blank. It must not print as $0. | Silver Spur Holdings LLC is two owner records and the dossier said 1 park and Debt on file $0. | dev | acquisitions-lead | open |
| 20 | The stage control shows "Not in the pipeline" until a stage is saved. It must not default to Target. | Every park that was not already a deal looked like it was in Target. The board had one card. | dev | acquisitions-lead | open |
| 21 | Owner letters do not say "you have held about N years." A maturity date appears only on the Maturity template, and only when the date is documented or reported. | First-contact drafts quoted a reported date and an estimated hold. The Maturity template already withholds an estimated date. | dev | acquisitions-lead | open |
| 22 | The prospects rate-shock cell says the coupon is estimated, or stays blank, when the note rate was not on the loan. | Silver Spur RV Resort showed +85 bps with a blank note rate. The park page says 7.00% is estimated. | dev | acquisitions-lead | open |
