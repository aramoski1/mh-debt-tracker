# Beacon port inventory

Cooper Cardinal buys and operates parks. Beacon is a South Florida broker CRM. This table is the decision record for `docs/port-beacon-prompt.md`. Status is updated in the same commit as the work.

Beacon was read from the local clone. It is not modified.

| Beacon | What it does | Park-buyer version | Decision | Target | Status |
| --- | --- | --- | --- | --- | --- |
| `lib/field-lock.ts` | Fill-only merge; county/manual/registry locks | Lock `jack`, `document`, and recorded tags. Weak writers fill blanks. EDGAR may replace an estimate. | Adapt | `pipeline/mhdebt/fieldlock.py`, `db.py`, `20261030000010_field_sources.sql` | Shipped. Park and loan upserts, operating and underwriting saves, and `test_fieldlock.py`. |
| `components/source-chip.tsx`, `lib/pa-verify.ts` | Source chip and a public verify URL | Chip plus EDGAR, Maricopa recorder, and assessor links from `prefix:id` | Adapt | `web/lib/verify.ts`, park page | Shipped: recorder link on a Maricopa document, and `verifyHref` for `mcrec`, `mcao`, and `edgar:{cik}/{accession}`. |
| `lib/ingestion-logger.ts`, `/properties/errors` | Sanitized ingestion errors, dismiss and resolve | Same stages for our jobs, Admin → Data issues | Adapt | migration, `mhdebt` logger, `/admin/issues` | Shipped. Failed source runs write a plain-language row. |
| `/properties/audit` | Flags bad property rows | Placeholder names, government owners, parcel with no owner, loan with no maturity, CMBS null maturity | Adapt | `/admin/audit` | Shipped against `park_overview`. It cannot yet see a parcel that failed to match. |
| `lib/jobs.ts` | Browser-polled queue, no retry, missing handler | Table, retry with backoff, a handler per type, nightly Action drains it | Adapt, do not copy the defect | `jobs` table, `.github/workflows` | Shipped. `mhdebt jobs` runs after the nightly pipeline. Unknown kinds are refused. |
| Copilot `askCopilot` | Sonnet tool loop, but tools filter to one user and answers are not linked | ⌘J panel, read-only tools, deep links, proposals the user clicks, saved threads | Adapt | `web/lib/copilot-knowledge.ts`, `/api/copilot` | Shipped as Ask on every page (⌘J). Answers use the prospect filters and link each park. A model may phrase only those rows. A separate tool per data type was not added; the same filters cover the questions. |
| `lib/jev-crm-search.ts`, smart lists | Regex hints plus a validated filter schema, saved lists | One bar, chips, ignored terms, saved views with one count query, alert when a park enters | Adapt | `web/lib/ask.ts`, `saved_views` | Shipped: rate shock, refinance gap, years held, East Valley, miles, stale contact, assumable. Saved views write to `saved_views`. A Haiku fallback is not used, so there is nothing to cast. Live counts and “new park entered” alerts are deferred. |
| Dashboard `today-desk.ts`, `dashboard-layout.ts` | Ranked today list, show/hide, no reorder, prefs in the browser | Command center with the debt priority order, drag reorder, prefs in Supabase | Adapt | `/desk` | Shipped: ranked “Do these today”, show/hide, drag reorder, saved on `user_settings`. Not every Beacon module has a card. |
| `lib/lead-finder.ts` buy boxes | Named boxes and a count before fetch | Named per-user boxes plus an acquisition fit score beside motivation | Adapt | `buy_boxes`, `web/lib/fit.ts` | Shipped on the park page beside owner pressure. The screen still edits the single `buy_box` row. `buy_boxes` exists for a later named box. |
| Owner portfolio and `entityOwnerNamesMatch` | Precision-first entity match, graph, AI brief | Dossier: debt, maturities, distress, map, timeline. No bag-of-words merge. | Adapt | `/owners/[id]`, `pipeline/mhdebt/entities.py` | Shipped: debt, next maturity, contacts, timeline, and a name match that rejects shared suffixes and statutory agents. No map and no model-written brief. |
| Sunbiz automation | Entity officers, including a Cloudflare workaround | eCorp link plus a paste box. Do not automate ACC. Do not copy the curl bypass. | Adapt the manual path. Skip the scraper. | owner page | Shipped: link to https://ecorp.azcc.gov/ and a paste saved as a note. The scraper is skipped. |
| `lib/ownership-watch.ts` | Flag, don't overwrite; oldest first | Watch toggle, nightly recorder and assessor diff, user reconciles | Adapt | `watches`, `watch_findings` | Shipped the toggle and the “not checked yet” copy. A nightly recorder sweep is deferred until it uses the document-code search already probed. Findings must not overwrite the owner. |
| Owner contacts, CoStar upload | Mailing address, uploaded exports tagged unverified | `contacts` from assessor mail, park phone, and a licensed upload. No people-search scrape. | Adapt | `contacts` | Shipped. New contacts stay unverified. No people-search scrape and no CoStar upload. |
| Deals kanban, forecast, LOI docx | Drag board, weighted volume, Word LOI | Our stages, forecast, LOI only from sourced underwriting figures | Adapt | `/pipeline`, `/loi/[id]` | Shipped: drag between stages, weighted price, win rate, and a printable letter from saved underwriting. Word export is deferred so we do not add a document library. |
| Cadence, follow-ups, `/week` | Tiers, nudge, bulk snooze, weekly target | Tiers from pipeline, score, and buy box. Follow-ups page. This week. | Adapt | `/follow-ups`, `/week`, `web/lib/cadence.ts` | Shipped. Bulk snooze is not on the page. |
| Outreach drafts | mailto, QA warns, never sends | Buyer templates. Never cite estimated debt or distress. Direct-mail PDF. | Adapt | `web/lib/outreach.ts` | Shipped: five buyer templates, a warning if distress or a dollar amount appears, mailto, and mark-as-sent. The letter is printable from the page, not a generated PDF. |
| Document review, citations | PDF jump, accept or reject, write-through | Loan and operating extraction with quotes, locked on accept | Adapt | park page, `park_documents` | Shipped: paste a quote, accept or reject. Accepted lot rent writes a document-tagged operating row. A PDF viewer is deferred; no storage bucket was created. |
| Tax-roll comps, rent notebook | Widening radius, minimum price | MH-parcel sale comps and Jack's lot-rent notebook | Adapt | park page, `rent_comps` | Shipped from sales already on the book (minimum $5,000) and a rent notebook. A widening live assessor search is deferred until it is probed. |
| Custom fields | Definitions injected into extraction | Parks, owners, loans, deals. Filterable. | Adapt | `field_definitions`, park page | Shipped on parks. Not yet injected into document extraction or Ask. |
| Table customization | Show/hide, resize, xlsx, bulk | Prospects, owners, pipeline, signals. Prefs per user in Supabase. | Adapt | `ProspectTable` | Partial: show/hide, density, CSV, bulk stage. Widths and xlsx not saved per user. |
| Onboarding, page guides, `?` | Wizard and `/how-it-works` | Portfolio import, first buy box, cadence, honest limits | Adapt | `/onboarding`, `/how-it-works`, `web/lib/guides.ts` | Shipped. Import matches names already on the book and does not create parks. |
| Firms and RLS isolation | Multi-tenant sharing | One firm, shared by default, private notes, invite-only, isolation test | Adapt | `firms` | The Cooper Cardinal firm row and policies are in the migration. A second user store was not built. `test_rls_sql.py` checks that the migration enables row level security. It does not log in as two users. |
| County router, address parse, ArcGIS paging | Florida and Massachusetts GIS | Probe each Arizona county before a job. Pinal had no MH code. | Adapt only after a probe and a fixture | `sources/` | Deferred until each layer is probed. Do not invent a use code. |
| Listing discovery | Search snippets, no robots check | Skip until a site's terms and robots allow it | Skip for now | — | Deferred. Beacon had no robots check. |
| Geocode Nominatim fallback | 1.1s throttle after Census | Add only as a throttled fallback | Adapt | `sources/geocode` | Not started. Census is already used. |
| Zoning point-in-polygon | Unavailable rather than a guess | Probe Maricopa, Pima, Phoenix, Mesa, Tucson first | Deferred until probed | — | Not started |
| GIS accuracy harness | Labeled top-1 rate | `mhdebt accuracy` once a labeled set exists | Adapt | `docs/ACCURACY.md` | Not started. No labeled set in the repo. |
| Dark-mode flash, `window.confirm`, skeletons | Small UX defects and patterns | Theme from the server cookie, confirm dialog, empty-state copy | Adapt | shell, `ConfirmDialog` | Shipped an inline script so dark mode is set before paint, a confirm dialog, and skeletons on the new work pages. Theme is still localStorage, read before paint. |
| Per-teammate sharing schema with no UI, OAuth email 501 | Unfinished Beacon | Do not port | Skip | — | Skipped |
| Lease abstracts, tours, commission, industrial specs, Sunbiz scrape, CoStar as a system of record | Broker leasing product | No equivalent that helps a buyer decide or reach an owner | Skip | — | Skipped |

## Phase notes

### Phase 1

Field locks are in `pipeline/mhdebt/fieldlock.py`. `test_fieldlock.py` covers Jack's values, an estimate replaced by EDGAR, a document that stays, blanks that do not clear, and untagged filled values. `upsert_park_by_source` and `upsert_loan` call it. `parks`, `loans`, `park_operating`, and `underwriting` have `field_sources`.

Data issues and the job queue shipped in `20261030000011_ops.sql`. The park page lists the loan source and a Maricopa assessor query for a linked parcel.

### Phases 2–5

Ask, Today, fit, the owner dossier, watches, contacts, the pipeline forecast, drafts, document quotes, custom fields, onboarding, and page guides are in the app and in demo data. County GIS expansion, zoning, Nominatim, listing discovery, a live recorder sweep, Word LOI export, and a PDF viewer stay deferred. Each one needs a probed source, a fixture, or a new library, and none of those were invented here.

`test_rls_sql.py` reads the migration files and checks that row level security is enabled. It does not sign in as two users.
