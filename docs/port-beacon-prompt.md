# Port everything valuable from Beacon into the Park Debt Tracker

## Your role

You are a senior full-stack engineer and product designer. You have shipped CRMs and institutional real estate tools, and you understand how a park buyer works a deal.

You are working in `aramoski1/mh-debt-tracker`. Read `PROJECT_CONTEXT.md` (pasted above or in the repo) first.

The user is Jack Cardinal's acquisitions team at Cooper Cardinal. They buy and operate mobile home parks and RV parks for their own portfolio, and already run about 30–40. They are **not brokers**. Every feature must help them do one of five things:
1. find an owner under debt pressure before the park is listed
2. decide whether the park fits and what to pay
3. decide how to finance it
4. reach the owner and work the deal to close
5. watch what changed overnight

## The source to mine

Beacon (`github.com/aramoski1/Beacon`, public) is our commercial real estate broker CRM on Next.js 16, Supabase and Claude. Clone it next to this repo (`git clone https://github.com/aramoski1/Beacon ../beacon`) and treat it as a reference library. **Read it. Do not copy it blindly.**

Start with these files, then read the actual code for every feature below before you port it:
- `Beacon_PRD.md`
- `Beacon_Pilot_Readiness.md`
- `Beacon_Expert_Panel_Review.md`
- `AGENTS.md`
- `.cursor/rules/keep-page-guides-current.mdc`

Your job is to transfer **every** feature, pattern, guardrail and small detail that would make this platform better, however small, translated into a park buyer's workflow. Where Beacon's idea is about leases or tenants, find the debt and distress equivalent. Where it doesn't fit, say so in the inventory and skip it.

## Rules

1. **Inventory before code.** Create `docs/BEACON_PORT.md` with one row per Beacon feature or pattern. Columns:
   - Beacon file(s)
   - what it does
   - the park-buyer version
   - decision (port, adapt or skip, with the reason)
   - target files here
   - status

   Show me the inventory before you build Phase 2.
2. **Keep this repo's conventions.** That means:
   - Next.js 15 App Router and our design tokens and components (`web/app/tokens.css`, `web/components/ui/`)
   - Supabase migrations in `supabase/migrations/` with row-level security
   - Python for ingestion in `pipeline/mhdebt/`
   - `PoliteClient` for all HTTP
   - `mhdebt probe` plus a fixture for every new source
   - demo mode with fictional data for every new screen
   - provenance on every number

   Don't bring over shadcn, Beacon's ad hoc styling, or its Next 16-only APIs.
3. **AI rules:**
   - Every Claude call is a forced tool call with a strict schema, validated on the server before anything is written.
   - Use Haiku for routing, interpretation, drafts and briefings, Sonnet for the copilot, and the strongest model for document extraction.
   - Values extracted from documents need a verbatim quote that is checked against the source.
   - The AI never writes to the database without a user click, and never sends anything.
4. **Data rules** (unchanged from the repo):
   - free sources only
   - respect terms of use and robots.txt
   - no scraping of LoopNet, Crexi, CoStar, MHVillage, Mobile Home Park Store, MHI or the Arizona Corporation Commission site
   - no getting around CAPTCHAs or Cloudflare
   - ask before creating any account or key
5. **Don't copy Beacon's known defects** (listed at the end).
6. **Small commits.** Tests, typecheck and demo mode stay green. Update `BUILD_GUIDE.md`, the page guides and the copilot's knowledge in the same commit as each change.

---

## Phase 1: Foundations Beacon got right

Port these first, because everything else depends on them.

### 1.1 Field-level provenance and locks
**In Beacon:**
- `lib/field-lock.ts` and the `field_sources` JSONB tag each field `county`, `manual`, `sunbiz`, `document`, `url`, `web` and so on.
- `LOCKED_SOURCE_TAGS` protects county, manual and registry values.
- `mergeFillOnly` writes only into empty, unlocked fields, never clears a value, and tags what it wrote.
- `isAuthoritativeFilled` protects old rows that were never tagged.
- `lib/document-enhancement.ts` `computeDocumentDiff` splits new data into changes, **conflicts** (each accepted or rejected on its own) and unchanged.

**Here:**
- Add `field_sources` to `parks`, `loans`, `park_operating` and `underwriting`. Tags: `edgar`, `recorder`, `assessor`, `sba`, `hud`, `agency`, `fdic`, `document`, `jack` (manual), `estimate`, `web`.
- Reported and recorded values, plus anything Jack typed, are locked.
- Enforce the lock in **every** writer, both Python `db.py` upserts and web routes. Beacon skipped this in `applyCountyEnhancement` and `upsertProperty`, so a county re-run overwrote manual edits. Write a test proving a nightly run never overwrites a value Jack entered.

### 1.2 Provenance UI
**In Beacon:**
- `components/source-chip.tsx` shows where a record came from.
- Each field gets a small `SourceTag` on the property page.
- A "Data sources" card shows per-source status.
- `confidence_flags` show as warnings on individual fields.

**Here:**
- Extend our reported / from document / estimated markers with a source chip on every loan, owner and operating field.
- Add a "Sources for this park" card listing each source, the as-of date and a link to the filing, recording or parcel.
- Add a verify link for each source, the way Beacon's `lib/pa-verify.ts` rebuilds the public page URL from a `prefix:id` key:
  - EDGAR filing index
  - Maricopa recorder document
  - assessor parcel page
- Adopt Beacon's `source_url` prefix convention: `mcao:{APN}`, `pima:{APN}`, `edgar:{accession}`, `mcrec:{recording no}`.

### 1.3 Error and ingestion logs
**In Beacon:**
- `lib/ingestion-logger.ts` writes `ingestion_errors`, with a typed `stage`, `source_ref`, a sanitized message and the raw text.
- `lib/error-messages.ts` `sanitizeIngestionError` turns rate-limit, billing and overload errors into plain sentences.
- `lib/logger.ts` provides `withAction`.
- `lib/error-reporter.ts` is a Sentry-compatible reporter with no SDK that never throws.
- `/properties/errors` and `/settings/errors` list errors with dismiss and bulk resolve.

**Here:**
- Add an `ingestion_errors` table written by the Python jobs. Stages: `edgar_fetch`, `recorder_fetch`, `assessor_fetch`, `ai_extract`, `match`, `db_save` and so on.
- Add an Admin → "Data issues" page with dismiss and resolve. Link it from `/freshness`.
- Add a parks audit page like Beacon's `/properties/audit`. It flags:
  - placeholder names ("Park at {address}")
  - government owners
  - parks with parcels but no owner
  - loans with no maturity
  - CMBS loans with a null maturity date

### 1.4 Jobs queue that actually runs
**In Beacon:** `lib/jobs.ts`, `background_jobs` and `/api/jobs/process`. It is half-built: it runs only when the browser sends a POST, has no retry, and has a job type with no handler.

**Here:** build it properly.
- A `jobs` table and a Vercel cron route (or the nightly GitHub Action) that processes it.
- Retries with backoff.
- Each job type has a handler, or creating that job fails.

Use it for on-demand work: enrich this park, re-check ownership, extract this document, rebuild this owner's portfolio.

---

## Phase 2: Find and prioritize

### 2.1 Copilot ("Ask the desk")
**In Beacon:** `components/beacon-copilot.tsx` and `app/copilot/actions.ts` `askCopilot`.
- Sonnet runs a tool loop of up to 6 rounds, with tool calls in parallel and read-only tools only.
- A cheap pre-router (`lib/jev-copilot.ts`) answers "can't do that" questions without calling Claude.
- The system prompt has three parts:
  1. platform knowledge: every route and button
  2. a **"What this app does NOT have, do not reference"** list
  3. a **fabrication hard rule**
- Example chips, a hand-written Markdown renderer for tables and lists, and an "AI-generated, verify" footer.

**Here, built better:**
- **Placement:** a panel available on every page from ⌘J and from the command palette, not only on the dashboard. It knows the current page's context: on a park page it already knows the park.
- **Read-only tools:**
  - `search_parks`: filters on score, fit, maturity window, lender type, rate shock, refi gap, county, sites, owner state, distress, pipeline stage
  - `get_park`: loan, sources, score drivers
  - `get_owner_portfolio`
  - `search_loans`
  - `get_rates`: today's index values and measured spreads
  - `run_refi_gap(park, rate, dscr, ltv)`
  - `run_underwriting(park, scenario)`
  - `search_distress_events`
  - `get_pipeline`
  - `get_alerts`
  - `get_recent_activity`
- **Answers:** every park, owner and loan in an answer is a **deep link**, and every number carries its provenance marker. Stream the responses, and save conversations per user.
- **Example questions:**
  - "Which Maricopa parks with bank debt mature in the next 18 months and are within 20 miles of a park we run?"
  - "What would Saguaro Ridge need to refinance at today's rates?"
  - "Who owns more than three parks in Pima County?"
  - "What changed overnight?"
- **Proposals:** it can **propose** actions (add to pipeline, set follow-up, draft outreach), which show as buttons the user clicks. It never writes on its own.
- **Prompt:**
  - Keep Beacon's "does NOT have" list for this app: no listings, no sending email, no paid data, no tenant data, no Arizona Corporation Commission data, and so on.
  - Keep the fabrication rule.
  - Keep the knowledge prompt in one file that must be updated in the same commit as any user-visible change.

### 2.2 Natural-language search and saved lists
**In Beacon:**
- `lib/jev-crm-search.ts` uses deterministic regex hints (`parseCrmSearchHints`: "20k", "over/under/between", "in/near X", "haven't contacted in N days") plus typed choices.
- A Haiku fallback uses a strict whitelisted filter schema (`interpret_crm_search`) plus a one-sentence `explanation`.
- `lib/crm-search-filters.ts` pure appliers turn the whitelist into PostgREST calls, so no SQL is ever generated.
- `SearchExplanation` shows how the sentence was read.
- Manual filters and AI filters produce the same shape, so both can be saved.
- `lib/lead-search-interpret.ts` sanitizes and refines: swaps inverted ranges, resolves conflicts, canonicalizes city aliases, and returns an `ignored: [{term, reason}]` list that the UI shows.
- **Smart lists** (`smart_lists`) have live counts. Loading one resets the manual filters, and editing a filter detaches it.

**Here:**
- One search bar on Prospects that understands park-buyer language and maps it to our whitelisted filters, for example:
  - "matures in 18 months"
  - "bank debt"
  - "rate shock over 250"
  - "refi gap over 500k"
  - "out-of-state owner"
  - "held 15+ years"
  - "60–200 sites"
  - "RV"
  - "within 25 miles of our parks"
  - "trustee sale"
  - "assumable agency loan"
  - "score over 50"
  - "not contacted in 60 days"
  - "Pinal" / "east valley" / "Tucson"
- Show the interpretation as removable chips, plus anything ignored with the reason ("Lot rent isn't in the public data").
- Validate Haiku's output before using it. Beacon casts it unchecked; don't.
- **Saved views** with live counts in the left nav, per user. Beacon's version is slow because it runs one query per list; use a single grouped query.
- Saved views can also drive alerts: "tell me when a new park enters this view."

### 2.3 Command center dashboard (a new home screen; Prospects remains its own page)
**In Beacon:** `app/dashboard/*`, `lib/dashboard-layout.ts`, `lib/today-desk.ts`.
- **Greeting:** a time-of-day greeting and a one-line playbook that never contradicts the desk ("N items need you today" vs "Nothing due today, N elsewhere").
- **KPI strip:** "—" when there is nothing.
- **Priority pills:** link to pages, appear only when the count is above zero, and never repeat the KPI cards.
- **Week momentum bar.**
- **Since your last visit:** what's new, what's cleared, the last few touchpoints. Renders nothing when nothing changed.
- **"Do these today" desk:** one ranked list across item kinds with pure scoring functions, ties broken by date. Structural signals always rank above relationship upkeep. A cheap model may only nudge the "soft" items, ±8 points.
- **Customize:** 20 modules show or hide. Stored as `user_settings.dashboard_layout {version, visible}` with **one** reader, `resolveVisible`, where a missing key means visible. Patches are sanitized. CSS `:has()` grids re-flow so hidden cards leave no holes. A hint card appears if everything is hidden.

**Here:**
- **Today desk kinds and fixed priorities:**
  1. new trustee sale notice or lis pendens on a target
  2. CMBS loan sent to special servicing or delinquent
  3. reported maturity within 6 months
  4. ownership change or new deed of trust on a watched park
  5. follow-up due or overdue
  6. deal next action due
  7. LOI or diligence deadline
  8. estimated maturity entering the 12-month window
  9. new park matching the buy box
  10. high-fit parks never contacted
  11. contact cadence overdue (capped lowest)

  Each row has a "why" sentence built from fields (reuse `lib/brief.ts` `callLine`) and a link.
- **KPIs:**
  - parks in the buy box
  - debt maturing within 12 months
  - new distress this week
  - active deals, plus pipeline value
  - calls made this week
  - median refi gap
  - today's 10-year Treasury and the CMBS spread
- **Modules:**
  - Today desk
  - since last visit
  - new distress
  - maturities by quarter chart
  - pipeline by stage, with stale deals (14+ days in a stage)
  - parks near our portfolio
  - rate moves
  - owners with multiple parks
  - ownership changes
  - data health (ingestion errors and stale sources)
  - recent activity grouped Today / Yesterday / weekday
- **Customize:** show/hide like Beacon, **plus drag-to-reorder**, which Beacon lacks. Store it per user in Supabase, not in local browser storage.

### 2.4 Second score: acquisition fit
**In Beacon:**
- `lib/lead-finder.ts` saves buy boxes in `lead_buy_boxes`.
- It counts matches before fetching (`returnCountOnly`, a `too_many` result).
- `buildCaveats` writes honest notes about each source's gaps.
- `acceptLeads` bulk-imports with a dedupe report.

**Here:**
- Upgrade our single-row `buy_box` to named, per-user buy boxes:
  - sites, kind (MHP, RV, mixed)
  - counties
  - price per site, cap rate floor
  - land tenure, city water/sewer
  - flood zone excluded
  - distance to our parks
  - minimum years held
- Compute an **acquisition fit score (0–100)** beside seller motivation. Show both everywhere (table, map, drawer, copilot). Explain each score in plain-English drivers with points, as we already do for motivation.
- Distance to our parks needs `portfolio` filled. Build an import for our 30–40 parks: paste addresses or APNs, or upload a CSV.

---

## Phase 3: Know the owner

### 3.1 Owner portfolio and entity graph
**In Beacon:**
- `app/owner-portfolio/*`, `lib/owner-portfolio.ts`, `lib/entities.ts`, `lib/portfolio-graph.ts`, `lib/mdpa-owner-search.ts`.
- **Search modes:** entity vs person.
- **WHERE clause:** the 2 longest non-stopword tokens for entities; all tokens for people.
- **Precision-first verification** (`entityOwnerNamesMatch`): an exact match, or an exact match after stripping LLC/INC, or a 2+ word core appearing contiguously in the other name. Bag-of-words is explicitly rejected because "Holdings" collides.
- **Person verification:** whole-token matching, so "vara" doesn't match "alvarado".
- **Fan-out:** across every county in parallel, merged by parcel ID.
- **In-CRM marking:** `attachCrmStatus` flags parcels already in the CRM.
- **Durable graph:** `entities`, `entity_properties`, `entity_contacts`, synced on every save. Stale links drop when the owner changes, and a loose name match never steals a row already linked to another entity.
- **Related parties:** `aggregateRelatedEntities` / `aggregateRelatedPersons`.
- **Attention flags:** `buildPortfolioAttentionFlags`.
- **Timeline:** one combined timeline.
- **Brief:** an AI "portfolio intelligence" summary with next actions, from a forced tool.

**Here:** rebuild `/owners/[id]` as a real dossier.
- Every park and every loan the owner and its related entities hold, across Maricopa, Pima and every county we add.
- Total debt, the next maturity, the weighted note rate, the combined refi gap.
- Distress across the portfolio.
- Mailing addresses.
- Years held.
- A map.
- One timeline: purchases, loans, assignments, releases, trustee notices, our calls.
- An AI brief, along the lines of: "Three parks, $14M of bank debt all maturing in 2027, owner in Washington. Lead with the Mesa park."

**Entity sources:**
- Assessor owner names and mailing addresses.
- CMBS borrower and sponsor names from EDGAR offering documents (424B annexes).
- Form D issuers and related persons.
- Grantor and grantee names on recorded deeds of trust.

**Entity rules:**
- Group shell LLCs that share a mailing address or a signer.
- **Exclude professional statutory agents and registered-agent companies** before linking on a shared person or address. Beacon doesn't, and it would merge unrelated owners.
- Arizona Corporation Commission eCorp is off-limits to automation (robots.txt). Offer a "look up on eCorp" link that opens the search in a new tab, plus a paste box where Jack drops what he found for Claude to extract. That is Beacon's `manualSunbizSearchUrl` and paste fallback pattern.

### 3.2 Ownership and debt change watch
**In Beacon:**
- `lib/ownership-watch.ts` re-fetches the owner and last sale.
- **Flags rather than overwrites:** it records `ownership_change_data {previous_owner, new_owner, …}` and the user reconciles.
- It separates `last_checked_at` from `detected_at`.
- `ownershipWatchEmptyCopy` honestly distinguishes "never checked" from "nothing changed".
- Batches take the oldest first.

**Here:**
- A "watch" toggle on any park, plus every pipeline and buy-box park enrolled automatically.
- Nightly, check:
  - the recorder for new documents on the parcel or owner: deed (sale), deed of trust (new debt), assignment, release (payoff), notice of trustee sale, lis pendens, cancellation
  - the assessor for owner and sale changes
  - EDGAR for loan status
- Each finding becomes an alert and a Today desk item. The stored owner or loan is never overwritten; the user reconciles.
- Show "last checked" on every park.

### 3.3 Owner contact data
**In Beacon:**
- Contacts come only from:
  - the county mailing address (`extractOwnerMailing`)
  - Sunbiz officers and agents
  - CoStar exports **the broker uploads**: Claude extracts them (`lib/costar.ts`) and tags them `["costar","unverified"]`
- `createOwnerContact` and promote-to-contact flows.
- `preferDisplayOwnerContact` chooses which contact to show.
- There is no paid skip trace.

**Here:**
- A `contacts` table linked to owners and entities, with:
  - role (owner, manager, broker, lender, attorney)
  - phone, email, mailing address
  - source and verified flag
- **Sources:** the assessor mailing address, the phone numbers we already have (28% of parks), CMBS servicer and borrower contacts in filings, and **uploads Jack is licensed to use**. Claude extracts contacts from a PDF, CSV or screenshot of an export, a business card, or a pasted email signature, each tagged unverified until confirmed.
- Never scrape people-search sites. Note any skip-trace vendor in `docs/PAID_UPGRADES.md` with price and terms.

---

## Phase 4: Work the deal

### 4.1 Pipeline upgrade
**In Beacon:**
- `lib/deals.ts`: `STAGES_BY_DEAL_TYPE`, `STAGE_PROBABILITY` for a weighted forecast (`forecast-panel.tsx`).
- `@dnd-kit` kanban with a stale flag after 14+ days, overdue next actions highlighted, and Delete hidden under "More".
- A list view.
- `validateCreateDeal` gives per-field errors.
- **Next-action sync:** setting a next action upserts exactly one open follow-up.
- Deal custom fields, activity, documents.
- **LOI as a Word file** (`lib/loi-template.ts`, `buildLoiDocx`).

**Here:**
- Use our stages (Target → Contacted → In conversation → Underwriting → LOI → Due diligence → Closed / Dead).
- Kanban with drag and drop, plus list and forecast views:
  - probability-weighted purchase volume and number of sites
  - expected close by month
  - win rate shown as "n won / n decided"
  - aging deals
- **Deal fields:**
  - price, price per site, cap rate
  - financing plan: new agency, bank, assume existing loan, seller note
  - earnest money, diligence and close dates
  - lost reason
- Diligence and close dates go on the Today desk.
- **LOI and offer letter:**
  - Build it only from figures the underwriting screen has sourced, with every estimate flagged before export.
  - Jack edits before anything leaves.
  - Our audit says to hold the letter until underwriting is sourced, so put it at the end of this phase.

### 4.2 Activity, follow-ups and cadence
**In Beacon:**
- **Quick actions:** call (Connected / Left VM / No answer, via `formatCallOutcomeNote`), email, tour, note, follow-up.
- **`FollowUpNudge`:** after any touch it asks "Set next follow-up?" with the date prefilled from the cadence.
- **Cadence bumps** (`shouldBumpLastContacted`): calls, emails and meetings reset the cadence clock; notes don't.
- **Cadence:** per-tier cadence days (`lib/cadence.ts`, 14/30/90).
- **Follow-ups page:** overdue / today / upcoming / done, with bulk snooze 7 days and bulk complete.
- **Activity timeline** with cross-links.
- **Jev reclassification:** a logged "note" becomes a call when it clearly was one.

**Here:**
- **Quick actions on every park and owner:** log call with outcome, site visit, email, note, follow-up. Then the nudge.
- **Owner tiers:**
  - Tier 1: in pipeline or score over 60
  - Tier 2: in the buy box
  - Tier 3: watch

  Each tier has a cadence, and the overdue list sits on the dashboard.
- **Follow-ups page** with bulk actions.
- **Keep** our Claude note structuring, which already extracts follow-ups.
- **"This week" page** (Beacon's `/week`): pin a saved view as this week's call list with a target number, and show "N of M worked".

### 4.3 Outreach drafting (never sends)
**In Beacon:** `app/outreach/*`.
- **Queue:** from the cadence or a saved list.
- **Templates:** four, each with instructions.
- **Batching:** Haiku in chunks of 10, capped at 25.
- **Prompt rules:** 3–5 sentences, at least one real fact, a fact-priority order, tone set by tier, the signature verbatim, and repeat-touch rotation when the owner already got recent emails.
- **Merge tokens:** substituted **after** generation, and the model is forbidden to invent values for them. A "merge only" mode skips the AI.
- **QA:** a cheap classifier asks "did it invent a fact / generic opener / reads like a blast" and **warns without blocking**.
- **Sending:** an "Open in Gmail/Outlook/mailto" button, a "Mark as sent" button that logs the touch and bumps cadence, and a test mode.

**Here:**
- **Templates for a principal buyer:**
  - first contact: "we buy and operate parks, not a broker"
  - maturity-aware: "if you're weighing a refinance next year"
  - portfolio owner
  - follow-up after a call
  - direct-mail letter: a printable PDF to the assessor mailing address, often the best channel for park owners
- **Facts allowed, in priority order:**
  1. our nearby parks
  2. a **documented** maturity
  3. years held
  4. park name and site count

  **Never** mention estimated debt figures or distress to the owner. Warn when a draft does.
- **Logging:** each send is logged as an activity and a cadence bump.

### 4.4 Documents and AI review
**In Beacon:**
- Lease abstraction sends the PDF to the strongest model with **`field_citations[{field, page, text}]`**.
- Review UI with react-pdf: clicking a citation jumps to the page and highlights the quote.
- `deriveConfidence` compares each value with its quote.
- Each field can be accepted, rejected or corrected, saved in `field_reviews`. Corrections write through to the real columns.
- Batch upload with per-file status.
- Exports to Word, Excel, PDF and an **ICS calendar** of critical dates.
- Documents attach to any record, up to 32 MB, with signed URLs.

**Here:**
- Upload or attach to a park, loan, owner or deal:
  - recorded deeds of trust and modifications
  - CMBS annex pages and servicer commentary
  - offering memorandums and rent rolls from owners
  - T-12s
  - appraisals
  - LOIs
- **Extraction:**
  - Loan terms: lender, amount, rate, maturity, amortization, prepayment, assumability.
  - Operating figures: lot rent, occupancy, park-owned homes, utility bill-back, NOI.
  - Every value comes with a page citation and a quote.
- **Review screen:**
  - Beacon's side-by-side PDF, with click-to-jump to the cited page.
  - Per-field accept, reject or correct.
  - Accepted values flow into `loans`, `park_operating` and `underwriting`, tagged `document` and locked.
- **ICS export** of maturity, diligence and close dates.

### 4.5 Underwriting and comps polish
**In Beacon:**
- Tax-roll comps: a radius search that widens in steps (same use → same class → any), a $5K minimum sale to drop quitclaims, cached 24 hours.
- Lease comps scored by similarity.
- A "rent notebook" of comps the broker enters.

**Here:**
- **Sale comps:**
  - Assessor sale prices on MH-use parcels within a radius that widens.
  - Drop non-arm's-length transfers with a minimum price and doc-type rules.
  - Compute price per site.
  - Cache.
- **Rent notebook:** Jack's lot-rent comps by submarket, with source and date.
- **Underwriting:** show where every input came from (comp, document, Jack, estimate).

---

## Phase 5: Make it customizable and self-explaining

### 5.1 Custom fields
**In Beacon:**
- `field_definitions` per entity (text, number, date or select), with values in a `custom_fields` JSONB column.
- **The clever part:** `buildCustomFieldsSchema` injects user fields into the AI extraction schema, so user-defined fields are pulled from documents automatically.
- Rename and scrub keep stored values consistent.
- Aliases auto-fill custom fields from source data.
- Custom fields appear as table columns and in exports.

**Here:** custom fields on parks, owners, loans and deals, for example:
- "Utility submetered"
- "Park-owned homes"
- "Private road"
- "Septic"
- "Jack's rating"

Inject them into document extraction and the copilot's tool schema, and make them filterable in NL search and saved views.

### 5.2 Table customization
**In Beacon:**
- Column show/hide with the always-on columns locked, and versioned storage keys.
- Drag-to-resize.
- Sticky first columns.
- Inline edit with Enter and Escape.
- "Export all / this page / selected", capped at 200 selected IDs.
- XLSX with custom-field columns.

**Here:**
- All of it on Prospects, Owners, Pipeline and Signals.
- Columns, widths, sort and density saved **per user in Supabase**, tied to the saved view.
- XLSX and CSV export.
- Bulk select: add to pipeline, watch, assign, export, draft outreach.

### 5.3 Onboarding, help and settings
**In Beacon:**
- An onboarding wizard (welcome → upload → map → import → done).
- **Column mapping:** an alias table, then a cheap model fills only unmapped headers at ≥0.65 confidence, never overwriting. Then a preview, a row cap and dedupe.
- **Page guides:** `lib/page-guides.ts` has about 30 entries (`purpose`, `walkthrough[]`, `features[]`). They feed a `/how-it-works` page and a floating **?** button with a modal on every page.
- **Honest limits:** a section saying what the app can't do.
- **A Cursor rule:** guides and the copilot prompt are updated in the same commit as any UI change.
- **Settings:** account, cadence days, connections, data download, appearance, team, a danger zone that requires typing DELETE.

**Here:**
- **Onboarding:**
  1. import our parks (the portfolio)
  2. set the first buy box
  3. set cadence tiers
  4. optionally upload a contact export
  5. land on the dashboard
- **Help:** page guides plus the **?** button plus `/how-it-works` with an **"Honest limits"** section. Use the real numbers:
  - maturity is estimated for most county loans
  - coverage percentages from `docs/COVERAGE.md`
  - no rent data unless entered
- **Cursor rule:** add `.cursor/rules/keep-guides-current.mdc` modeled on Beacon's.

### 5.4 Team (light version)
**In Beacon:**
- `firms`, `firm_members` and `firm_invitations`.
- `visibility` private or team, with an **additive** row-level-security OR-clause.
- A share toggle that only renders in a multi-member firm.
- A "My book / Entire firm" toggle.
- Invite-only signup with an approved-email list.
- `requireUser()` re-checks revocation on every page.

**Here:**
- One firm (Cooper Cardinal) with roles owner, admin and member.
- Shared by default, since it's one buying team, plus per-user private notes.
- Invite-only access, an admin users page, revocation, and an `activity_log`.
- Add a multi-account row-level-security isolation test. Beacon's pilot list calls this out.

### 5.5 Small details to carry over
- **Empty states** are always instructional. They distinguish "not checked yet" from "nothing found" from "nothing exists".
- **`ConfirmDialog`** replaces `window.confirm`, with danger and busy states.
- **Loading skeletons** on every route that match the final layout. Beacon has only 3.
- **Badges** cap at "99+".
- **"+ New" menu:** add park, add owner contact, upload document, new deal.
- **Mobile:** a top bar with a drawer.
- **Money formatting:** "$1.2M", "45 sites", "—" for nothing.
- **Since-last-visit:** stored server-side, not in browser storage.
- **Dark mode** without a flash on load. Beacon flashes because it reads the theme from browser storage.
- **Pure-module pattern:** scoring, filters, cadence, layout and merges live as pure `lib` functions with unit tests. AI wrappers expose a pure decision function.
- **Cheap classifier in front of expensive calls:** skip extraction on junk documents, and fail open.
- **Demo seeding:** a `seed:demo` script that tags rows and can reset.

---

## Data techniques to transfer (Beacon → Arizona)

| Beacon technique | Files | Arizona version |
| --- | --- | --- |
| County router with `{ok, error, too_many}` results, parallel fallback when the county is unknown, county recovered from the ID format | `lib/county-router.ts` | Router across Maricopa, Pima, Pinal, Yuma, Yavapai and Mohave assessor ArcGIS layers. Probe each layer and its MH use codes first; Pinal had no MH code in our last probe. |
| Address parsing for GIS: house-number ranges, spelled numbers, directional and street-type stripping, alphanumeric-only keyword (injection guard), word-boundary checks, ordinal retries, block-range fallback, ranking candidates | `parseAddressForGIS` in `lib/mdpa.ts`, `lib/bcpa.ts` | Use for park-address → APN matching. Parks often span several parcels and list the office address, so return every parcel for the owner at that address. |
| ArcGIS paging: `returnCountOnly` precount, `resultOffset`, `exceededTransferLimit`, error-message fallback | `lib/lead-finder.ts`, `lib/*-owner-search.ts` | Use in `sources/arcgis.py`. |
| Owner-name search across counties, entity vs person modes, precision-first verification | `lib/mdpa-owner-search.ts`, `entityOwnerNamesMatch` | Owner portfolio across all assessor layers, plus recorder grantor/grantee names. |
| Entity registry lookup with Claude extraction of officers and agents | `lib/sunbiz.ts` | ACC is off-limits to automation, so use a manual link plus paste-to-extract. **Don't** copy Beacon's curl / Cloudflare fingerprint workaround. |
| Change watch: flag, don't overwrite, oldest first | `lib/ownership-watch.ts` | Recorder sweep by document code and date (trustee sale, deed of trust, release, assignment, deed) plus assessor diffs, nightly. |
| Mailing address extraction; individual-owner contact | `extractOwnerMailing`, `lib/owner-contacts.ts` | Assessor mailing address on every owner; flag out-of-state owners. |
| Claude extraction: forced tool, source-only prompt, explicit list of allowed inferences, `confidence_flags`, server validation, deterministic overlay from structured fields after the model | `lib/property-pipeline.ts`, `MDPA_SYSTEM_PROMPT` | Apply to recorded documents, CMBS annexes, rent rolls and OMs. Keep our verbatim-quote check on top. |
| Web listing discovery: search-API snippets only for blocked hosts, an address-match gate, a verbatim citation for every value, fill-only, tagged `web` | `lib/listing-discover.ts` | Optional, later. Only on sites whose terms allow it, with a robots.txt check (Beacon has none). |
| Zoning point-in-polygon, with "unavailable" results instead of guesses | `lib/zoning.ts` | Maricopa and Pima county zoning plus Phoenix, Mesa and Tucson. Probe each. Store `zoning_checked_at`. |
| Geocoding: Census first, Nominatim throttled to 1.1s for pins | `lib/geocode.ts` | We already use Census. Add the throttled fallback. |
| Comps with widening radius and a minimum price | `lib/mdpa-comps.ts` | Sale comps on MH parcels (Phase 4.5). |
| GIS accuracy harness: labeled CSV, top-1 match rate | `scripts/check-gis-accuracy.ts` | `mhdebt accuracy`: a labeled set of known parks with APN and owner for each county. Report the match rate in `docs/ACCURACY.md`. |
| Data health pages | `/properties/errors`, `/properties/audit` | Phase 1.3. |

## Beacon defects not to copy

- **County writes ignore field locks.** In `applyCountyEnhancement`, core fields are written with no lock check, so county re-runs overwrite manual edits.
- **Jobs never run on their own.** The jobs queue only runs on a client POST, has no retry, and `enrich_property` has no handler.
- **Copilot can't see shared records.** Its tools filter by `owner_id`. It also has no streaming, no saved history and no deep links.
- **Haiku search output is cast, not validated.**
- **The dashboard KPI cache is never invalidated on writes.**
- **Today-desk follow-up links all go to the same page.**
- **Smart-list counts run N queries.** Custom-field rename and scrub loop row by row.
- **Per-teammate sharing has a schema but no UI.** OAuth email is a 501 stub.
- **Dark mode flashes on load.** There are skeletons on only 3 routes, and nothing checks robots.txt.

## Done means

- `docs/BEACON_PORT.md` lists every Beacon feature with a port, adapt or skip decision. Every "port" or "adapt" row is shipped or explicitly deferred with a reason.
- **The new surfaces work in demo mode with fictional data:**
  - copilot
  - NL search
  - saved views
  - the command center (with customize and reorder)
  - the fit score
  - the owner dossier
  - change watch
  - contacts
  - the pipeline (kanban and forecast)
  - activity and cadence
  - outreach drafts
  - document review
  - custom fields
  - table customization
  - onboarding
  - page guides
  - data health
- Field locks are enforced in every writer, with a test.
- The copilot's knowledge prompt, page guides and `/how-it-works` match the shipped app.
- Tests, typecheck and lint pass. Row-level-security isolation is tested, and `BUILD_GUIDE.md` is updated.
- A short summary: what shipped, what was skipped and why, and screenshots of the five most important new screens.

Start with the inventory and Phase 1. Show me `docs/BEACON_PORT.md` and the field-lock test before you start Phase 2.
