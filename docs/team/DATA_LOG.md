# Data log

Newest first. Written by the data-scout. Each entry lists: the gap, sources found, terms decision, probe result and fixture path, measured coverage and accuracy, and the handoff to the developer.

## 2026-11-16 — cmbs source vs community bank on three demo parks

Gap: Golden Sun Mobile Home Park, Silver Spur Manufactured Home Community, and Saguaro MHP show `loan_source = cmbs` and `lender_kind = community_bank` on the same primary loan. No new source. No market figure.

What the two fields are: `park_overview.loan_source` is `loans.source` on `park_scores.primary_loan_id` (the filing bucket that wrote the row). `lender_kind` is `lenders.kind` on that same loan. They are not two loans mixed together.

Verified in `web/demo/data.json` (fictional):

| Park | Loan | source_loan_id | Lender | Kind | Raw |
|---|---|---|---|---|---|
| Golden Sun Mobile Home Park | `4136377c-1a7d-43df-986f-91c0c2e7f69e` | `demo-24` | Commerce Bank of Arizona | community_bank | null |
| Silver Spur Manufactured Home Community | `424259b6-b126-46af-8f41-eea462b4fb8c` | `demo-4` | Alliance Bank of Arizona | community_bank | null |
| Saguaro MHP | `898dfd6a-9fb1-4c10-bdc0-7581e17242e9` | `demo-42` | Arizona Bank & Trust | community_bank | null |

Each maturity basis is `reported`. There is no trust name, CIK, or originator.

Seed cause: `pipeline/scripts/make_demo.py` draws the lender (including those three community banks) and, on the "published loan with a known date" branch, always writes `source='cmbs'`. The lender kind is not read. In this demo file, 12 overview rows have `loan_source` cmbs and none of them have lender kind `cmbs_trust`. Eight of the twelve are `community_bank`.

Live path: `upsert_cmbs_loan` is the only production writer of `source='cmbs'`. It sets the lender to the SEC trust name and asks for kind `cmbs_trust`. The originator stays in `raw.originator`. `classify_lenders` will not replace an existing `cmbs_trust`. `upsert_lender` keeps a non-unknown kind already stored under the same normalized name, so a trust-name collision could keep a wrong kind. These three bank names are not that case.

Verdict: believe **Community bank**. `Loan: cmbs` is the raw source code, and on these rows it is false. Correct `loans.source` to `county`. Keep `lender_kind`. The `reported` maturity basis is the same shortcut, not a servicer tape.

Handoff: correct the demo seed. Do not add a source. Item 14 stays where it is. The desk label for these notes is Community bank; the filing label, once the seed is corrected, is County record.
