# Beacon port inventory

Cooper Cardinal buys and operates parks. Beacon is a South Florida broker CRM. This table is the decision record for `docs/port-beacon-prompt.md`. Status is updated in the same commit as the work.

Beacon was read from the local clone. It is not modified.

| Beacon | What it does | Park-buyer version | Decision | Target | Status |
| --- | --- | --- | --- | --- | --- |
| `lib/field-lock.ts` | Fill-only merge; county/manual/registry locks | Lock `jack`, `document`, and recorded tags. Weak writers fill blanks. EDGAR may replace an estimate. | Adapt | `pipeline/mhdebt/fieldlock.py`, `db.py`, `20261030000010_field_sources.sql` | Shipped. Park and loan upserts, operating and underwriting saves, and `test_fieldlock.py`. |
| `components/source-chip.tsx`, `lib/pa-verify.ts` | Source chip and a public verify URL | Chip plus EDGAR, Maricopa recorder, and assessor links from `prefix:id` | Adapt | `web/lib/verify.ts`, park page | Not started |
| `lib/ingestion-logger.ts`, `/properties/errors` | Sanitized ingestion errors, dismiss and resolve | Same stages for our jobs, Admin → Data issues | Adapt | migration, `mhdebt` logger, `/admin/issues` | Not started |
| `/properties/audit` | Flags bad property rows | Placeholder names, government owners, parcel with no owner, loan with no maturity, CMBS null maturity | Adapt | `/admin/audit` | Not started |
| `lib/jobs.ts` | Browser-polled queue, no retry, missing handler | Table, retry with backoff, a handler per type, nightly Action drains it | Adapt, do not copy the defect | `jobs` table, `.github/workflows` | Not started |
| Copilot `askCopilot` | Sonnet tool loop, but tools filter to one user and answers are not linked | ⌘J panel, read-only tools, deep links, proposals the user clicks, saved threads | Adapt | `web/lib/copilot-knowledge.ts`, `/api/copilot` | Partial: one-shot answer exists. Tool loop not started. |
| `lib/jev-crm-search.ts`, smart lists | Regex hints plus a validated filter schema, saved lists | One bar, chips, ignored terms, saved views with one count query, alert when a park enters | Adapt | `web/lib/ask.ts`, `saved_views` | Partial: deterministic Ask exists. Saved views are browser-only. Haiku path not validated yet. |
| Dashboard `today-desk.ts`, `dashboard-layout.ts` | Ranked today list, show/hide, no reorder, prefs in the browser | Command center with the debt priority order, drag reorder, prefs in Supabase | Adapt | `/desk` | Partial: Today page exists, browser show/hide only, priority order is not the spec's. |
| `lib/lead-finder.ts` buy boxes | Named boxes and a count before fetch | Named per-user boxes plus an acquisition fit score beside motivation | Adapt | `buy_boxes`, scoring | Not started. One `buy_box` row exists. |
| Owner portfolio and `entityOwnerNamesMatch` | Precision-first entity match, graph, AI brief | Dossier: debt, maturities, distress, map, timeline. No bag-of-words merge. | Adapt | `/owners/[id]` | Not started. A park list exists. |
| Sunbiz automation | Entity officers, including a Cloudflare workaround | eCorp link plus a paste box. Do not automate ACC. Do not copy the curl bypass. | Adapt the manual path. Skip the scraper. | park/owner page | Not started |
| `lib/ownership-watch.ts` | Flag, don't overwrite; oldest first | Watch toggle, nightly recorder and assessor diff, user reconciles | Adapt | `ownership_watches`, alerts | Not started |
| Owner contacts, CoStar upload | Mailing address, uploaded exports tagged unverified | `contacts` from assessor mail, park phone, and a licensed upload. No people-search scrape. | Adapt | `contacts` | Not started |
| Deals kanban, forecast, LOI docx | Drag board, weighted volume, Word LOI | Our stages, forecast, LOI only from sourced underwriting figures | Adapt | `/pipeline` | Partial: board and balance exist. No drag, no forecast, no LOI. |
| Cadence, follow-ups, `/week` | Tiers, nudge, bulk snooze, weekly target | Tiers from pipeline, score, and buy box. Follow-ups page. This week. | Adapt | `/follow-ups`, `/week` | Partial: seven-day list on the home page. |
| Outreach drafts | mailto, QA warns, never sends | Buyer templates. Never cite estimated debt or distress. Direct-mail PDF. | Adapt | `web/lib/outreach.ts` | Partial: one call-line draft, mailto only when an email is on file. |
| Document review, citations | PDF jump, accept or reject, write-through | Loan and operating extraction with quotes, locked on accept | Adapt | `/documents` | Not started. Notes extract facts. No PDF review. |
| Tax-roll comps, rent notebook | Widening radius, minimum price | MH-parcel sale comps and Jack's lot-rent notebook | Adapt | underwriting tab | Not started. Assessor sale price is shown when present. |
| Custom fields | Definitions injected into extraction | Parks, owners, loans, deals. Filterable. | Adapt | `field_definitions` | Not started |
| Table customization | Show/hide, resize, xlsx, bulk | Prospects, owners, pipeline, signals. Prefs per user in Supabase. | Adapt | `ProspectTable` | Partial: show/hide, density, CSV, bulk stage. Widths and xlsx not saved per user. |
| Onboarding, page guides, `?` | Wizard and `/how-it-works` | Portfolio import, first buy box, cadence, honest limits | Adapt | `/onboarding`, `/how-it-works` | Not started |
| Firms and RLS isolation | Multi-tenant sharing | One firm, shared by default, private notes, invite-only, isolation test | Adapt | `firms` | Not started. Sign-in is Supabase. |
| County router, address parse, ArcGIS paging | Florida and Massachusetts GIS | Probe each Arizona county before a job. Pinal had no MH code. | Adapt only after a probe and a fixture | `sources/` | Deferred until each layer is probed. Do not invent a use code. |
| Listing discovery | Search snippets, no robots check | Skip until a site's terms and robots allow it | Skip for now | — | Deferred. Beacon had no robots check. |
| Geocode Nominatim fallback | 1.1s throttle after Census | Add only as a throttled fallback | Adapt | `sources/geocode` | Not started. Census is already used. |
| Zoning point-in-polygon | Unavailable rather than a guess | Probe Maricopa, Pima, Phoenix, Mesa, Tucson first | Deferred until probed | — | Not started |
| GIS accuracy harness | Labeled top-1 rate | `mhdebt accuracy` once a labeled set exists | Adapt | `docs/ACCURACY.md` | Not started. No labeled set in the repo. |
| Dark-mode flash, `window.confirm`, skeletons | Small UX defects and patterns | Theme from the server cookie, confirm dialog, empty-state copy | Adapt | shell, dialog | Partial: theme is in localStorage (can flash). |
| Per-teammate sharing schema with no UI, OAuth email 501 | Unfinished Beacon | Do not port | Skip | — | Skipped |
| Lease abstracts, tours, commission, industrial specs, Sunbiz scrape, CoStar as a system of record | Broker leasing product | No equivalent that helps a buyer decide or reach an owner | Skip | — | Skipped |

## Phase notes

### Phase 1

Field locks are in `pipeline/mhdebt/fieldlock.py`. `test_fieldlock.py` covers Jack's values, an estimate replaced by EDGAR, a document that stays, blanks that do not clear, and untagged filled values. `upsert_park_by_source` and `upsert_loan` call it. `parks`, `loans`, `park_operating`, and `underwriting` have `field_sources`.
