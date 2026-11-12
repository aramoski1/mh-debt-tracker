# Backlog

Ranked work for the team. Highest value to a buy decision first, then lowest effort. The developer keeps this current.

**Status values:** `open`, `in progress`, `blocked: <reason>`, `done`, `cut`.

**Owner values:**
- `dev`: the developer
- `data`: the data-scout
- `acq`: the acquisitions-lead

| # | Item | Why it matters | Owner | From | Status |
|---|---|---|---|---|---|
| 0 | Feature audit: the acquisitions-lead runs every shipped screen and feature through the value test. Each one is marked keep, simplify or cut, and the cut list goes to the user for approval. | The Beacon port added many features. A smaller app Jack trusts beats a big one he doesn't. | acq → dev | user | open |
| 1 | Recorder distress sweep by document code and date (trustee's sale notices, lis pendens, releases, assignments) for Maricopa, matched to parks | Post-purchase distress is almost entirely missing. It is the strongest seller signal. | data → dev | AUDIT.md | open |
| 2 | Labeled accuracy set: 20+ hand-checked parks per county (APN, owner, loan, maturity) plus a match-rate report | Without it, every accuracy claim is an opinion | data | DATA_PLAYBOOK | open |
| 3 | Maturity holdout and calibration: hide known CMBS/SBA maturities, estimate, report p10–p90 coverage | County-loan maturities drive the score and are wide | data → dev | AUDIT.md | open |
| 4 | Fix CMBS loans with a null maturity (parse gap or truly absent; prove it with a fixture) | Reported dates are the most trustworthy facts we have | data → dev | AUDIT.md | open |
| 5 | End-to-end test harness: Playwright in `web/e2e/` running the core workflow in demo mode, plus a CI job | The acquisitions-lead needs repeatable regression tests | dev + acq | team setup | open |
| 6 | Acquisitions-lead's first full walkthrough: core workflow, money math by hand, edge cases, phone width | Baseline of what blocks daily use | acq | team setup | open |
| 7 | Pima recorder (verify API or bulk access), then Pinal parcels and use codes | Pima is 26% of parks with no loan documents | data | COVERAGE.md | open |
| 8 | Update `.cursor/rules/project.mdc`: it still says "brokerage team" | Wrong framing leaks into every agent's output | dev | team setup | open |
| 9 | FFIEC call reports: bank CRE concentration and noncurrent loans by lender, as a lender-stress input | Most park debt is bank debt we can't see. Lender stress is a proxy. | data | DATA_PLAYBOOK | open |
| 10 | Treasurer tax delinquency and lien lists (Maricopa, Pima, Pinal), matched to parks | Cheap, strong distress signal | data → dev | DATA_PLAYBOOK | open |
