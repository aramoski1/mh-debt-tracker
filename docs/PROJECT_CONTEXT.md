# Project context: Park Debt Tracker for Cooper Cardinal

Paste this at the start of a new chat. It covers the client, the product, the code, the data, what works and what doesn't, as of November 11, 2026.

---

## 1. The client and the goal

**Cooper Cardinal & Company** (coopercardinal.com) is a Phoenix firm run by **Jack Cardinal**.
- It buys and operates mobile home parks (MHPs) and RV parks for **its own portfolio**. It already manages roughly 30–40 parks.
- It is **not an acquisitions broker**. Every feature should help a principal decide which parks to pursue, what to pay, how to finance them, and how to work the deal. It should not help someone list or sell parks for others.

**Who is building it.** Alec is building this through Vertical Frame (verticalframe.ai, an AI-native software company for trades and physical industries). It came out of a discovery call in October 2026. Of the ideas raised, Jack was most interested in a **debt and financing tracker**: find parks whose owners face a loan maturity, a refinance at much higher rates, or distress, before the park is listed.

**The thesis.** Many park owners took loans at 3–5% in 2016–2021. Those loans mature into 6–8% money. An owner who can't cover the refinance gap is a motivated seller. Paid tools (Trepp, TreppWire, CRED iQ, Real Capital Analytics) sell this signal for CMBS loans. We rebuild it from free public data for **all** park debt (bank, CMBS, agency, SBA, seller carry), starting with **Arizona**.

## 2. Stack and where the code lives

- **Repo:** `github.com/aramoski1/mh-debt-tracker` (private). Main branch.
- **Database:** Supabase project `park-debt-tracker` (ref `mlwseriuekgimfzqxzsd`, us-west-1). Migrations live in `supabase/migrations/`, and row-level security is on for every table. The migrations through `20261030000012_buyer_desk.sql` are applied on that project.
- **Pipeline:** Python 3.11, in `pipeline/mhdebt/`.
  - The CLI is `mhdebt`: `ingest`, `build`, `extract`, `model`, `run`, `jobs`, `top`, `probe`, `holdout`, `rates`.
  - Outbound pipeline requests go through `PoliteClient`, which handles per-host rate limits, retries, and a cache.
  - A nightly GitHub Action (`.github/workflows/pipeline.yml`) is scheduled for 09:17 UTC, which is 2:17 AM Arizona. GitHub may start it later. It runs `mhdebt run`, then `mhdebt jobs`. An empty `DATABASE_URL` stops the run before any download. With `ANTHROPIC_API_KEY` set, the run reads up to `MAX_DOCS_PER_RUN` pending loan documents and then rescores. Both of those Actions secrets are set. CI tests run against a Postgres service, and a second job runs the demo Playwright check (`web/e2e`, date pinned to 2026-11-12).
  - Python, because the data work (EDGAR XML, spreadsheets, fuzzy matching, statistics) is easier there, and the web app only reads from the database.
- **Web app:** `web/`, built on:
  - Next.js 15.5 (App Router) with React 19, `@supabase/ssr`, Tailwind 4 and design tokens in `web/app/tokens.css`
  - MapLibre for maps, TanStack Table + Virtual for the prospect table, Radix for dialogs, popovers and tooltips, Recharts for charts
  - the Anthropic SDK
- **Hosting:** Vercel, not yet deployed. Demo mode (`NEXT_PUBLIC_SUPABASE_URL=demo`) serves fictional data from `web/demo/*.json`.
- **Editor:** Cursor. Project rules are in `.cursor/rules/*.mdc` (`project`, `docs`, `new-source`, `web`, `team`), and `BUILD_GUIDE.md` is the setup walkthrough.
- **Docs in the repo:**
  - `docs/AUDIT.md`: an honest audit of coverage, accuracy, workflow and UI
  - `docs/COVERAGE.md`: what is loaded and what was rejected
  - `docs/DATA_SOURCES.md`
  - `DATA_SOURCE_CATALOG.md`: about 150 sources marked verified/partial/unverified with priorities
  - `docs/ACCURACY.md`, `docs/PAID_UPGRADES.md`
  - `docs/ui/BRAND.md` and `docs/ui/SCREENS.md`
- **Ground rules:**
  - Respect terms of use and robots.txt.
  - Never scrape LoopNet, Crexi, CoStar, MHVillage, Mobile Home Park Store, the MHI database, or the Arizona Corporation Commission site (its robots.txt disallows it).
  - Never invent endpoints or fields. Every source needs a `mhdebt probe` plus a saved fixture.
  - Every number carries its provenance: reported, from a document, or estimated.
  - Demo data is always fictional.

## 3. How the data model works

**Parks.**
- Comes from the HIFLD mobile home park list, plus park-use parcels from county assessors (Maricopa PUC 0840–0899, plus Pima). Joined by spatial and name matching (`match.py`, with a contradiction gate so different parks aren't merged). A blank phone, website, or other nullable park field is stored empty and does not stop the load. The park name is required.
- About **2,249 Arizona parks** are scored. Maricopa has 759, Pima 595, then Yuma, Pinal, Yavapai and Mohave.

**Loans** (`loans`):
- **SEC EDGAR CMBS:** the 10-D EX-102 asset tapes (property type `MH`) give balance, rate, maturity, NOI and DSCR. Portfolio loans are split across parks by their share. A loan is marked paid off when it drops out of a filing that was actually retrieved. An empty filing list does not pay the book off. A loan that shows up again is active, and a later tape replaces the balance, rate, and maturity that the same source wrote.
- **County recorder:** the Maricopa recorder public API supplies deeds of trust, releases, assignments and trustee notices. Pima recorder exports load from files. Loan status is rebuilt by replaying the documents in date order: release, refinance, foreclosure notice, cure.
- **SBA:** the 7(a) and 504 FOIA files, for RV parks (NAICS 721211).
- **HUD FHA:** Section 207 "mobile home courts" loans. None are in Arizona yet.
- **Agency:** Fannie DUS and Freddie importers exist but have loaded nothing, because the terms aren't cleared.
- **Lenders:** classified by type (community bank, CMBS, agency, credit union, SBA, life company, debt fund, seller carry) using FDIC BankFind plus name lists.

**Maturity.**
- An exact date when it is reported or found in a document.
- Otherwise `maturity.py` estimates it from term priors by lender type, plus survival weights. Old loans keep some chance of being past due rather than being renormalized.
- Each estimate stores a likely date, a p10–p90 range, `prob_24m` and `prob_past_due`.

**Claude document reading** (`docai.py`):
- Pulls loan terms from recorded documents using forced tool use.
- Each value must come with a **verbatim quote**, and a value is kept only if the quote appears in the source text.
- Claude also turns typed call notes into structured follow-ups.

**Rates.**
- `rate_prints` holds daily FRED data (DGS5, DGS7, DGS10, prime, BAA10Y), the Treasury par yield curve and NY Fed SOFR.
- `spreads.py` measures spreads from stored CMBS and SBA loans (note rate minus the matching Treasury on the origination date), as medians by lender type, term and quarter, with sample size.
- Today's refinance rate is the index plus the measured spread. Jack's own lender quotes are meant to override it.

**Seller-motivation score (0–100)** (`scoring.py`):

| Component | Points |
| --- | ---: |
| Maturity timing | 35 |
| Rate shock | 20 |
| Refinance gap (cash needed to refinance at today's rate and DSCR/LTV limits) | 20 |
| Lender type | 10 |
| Owner (out of state, years held, number of parks) | 15 |

- Fully amortizing loans don't count as pressure.
- Results are written to `park_scores` and `park_score_history`.

**Other tables:**
- `park_operating`: rent, vacancy, RV share, land tenure. Entered by hand, and still empty in production.
- `underwriting`: price, cap rate, lot rent, occupancy, expenses, growth, sites.
- `deals`: pipeline stage and next action.
- `portfolio`: Cooper Cardinal's own parks.
- `buy_box`: one row with sites, states and kinds.
- `water_systems`.
- Signals tables: `distress_events`, `transactions`, `entities`, `entity_links`, `filing_hits` (EDGAR full-text search links), `form_d_offerings`.
- `alerts`, `activities`, `source_runs`, `source_state`.
- The view `park_overview` is what the web app reads.

**Signals added on Oct 30:**
- Form D issuers with MH/RV names
- EDGAR full-text hits
- EX-99 links
- Google News RSS headlines
- the BLS Arizona unemployment rate
- FEMA flood zones
- EPA water systems
- 572 Maricopa assessor sale prices
- 40 distress events, not yet tied to parks

## 4. The web app today

| Route | What it does |
| --- | --- |
| `/` | **Prospects.** Four counts, a "calls worth making" list with a one-sentence call line (`lib/brief.ts`), a virtualized table with filters, and a map. Keyboard navigation with j/k. |
| `/desk` | **Today.** Ranked work for the morning: distress, upcoming maturities, follow-ups, and buy-box fits. Blocks can be hidden or reordered. |
| `/follow-ups`, `/week` | Follow-ups due, and the week's deadlines. |
| `/parks/[id]` | **Park page.** Score and why, fit, cadence, maturity range, loan history, documents, buyer email drafts (they open the user's mail client and do not send), the operating figures form, the underwriting desk, a watch flag, and print. |
| `/pipeline` | Deal stages (Target, Contacted, In conversation, Underwriting, LOI, Due diligence, Closed, Dead) plus the buy-box form. |
| `/loi/[id]` | A printable offer from the saved underwriting. Estimates stay labeled as estimates. |
| `/rates` | **Rate desk.** Treasury tenors, SOFR, prime, the CMBS spread, Arizona unemployment, and charts. |
| `/signals` | Tabs: FHA, Form D, filings, distress, sales, owners. |
| `/markets` | Counties ranked by number of parks. |
| `/owners`, `/owners/[id]` | Recorded owner names, and one owner's parks, debt, and a place to paste an Arizona Corporation Commission page. |
| `/portfolio` | Cooper Cardinal's own parks. |
| `/alerts` | Maturity windows, distress, score jumps. |
| `/onboarding` | Mark managed parks and set the buy box. Import matches existing park names. It does not create parks. |
| `/how-it-works` | What the desk can and cannot show. |
| `/admin`, `/admin/audit`, `/admin/issues`, `/freshness` | Admin, the park audit, failed source runs, and the source freshness log. |
| `/styleguide` | Internal component demo page. Available while `next dev` is running. |
| `/login` | **Sign in** sends a link only when the email already has an account. **Create account** sends the link that creates one. |

- **Shell:** a left nav, Ask, a help button, and a ⌘K command palette that turns a sentence into prospect filters.
- **API routes:** alerts, buy-box, deals, notes, operating, portfolio, underwriting, copilot, calendar, rents, fields, documents, contacts, watches, settings, views, issues.

## 5. Honest weaknesses (from `docs/AUDIT.md`)

**Thin coverage:**
- 34% of parks have an owner.
- 13% have any loan.
- 2% have a reported maturity on an open loan.
- 0% have operating figures.

**Low scores.** The live maximum is about 50 and the average about 4, because a park with no loan earns almost no points.

**Missing distress data.** The recorder job only reads the documents right after each parcel's last deed, so it misses later trustee sales, lis pendens and refinances. The fix is a sweep by document code and date.

**Wide maturity estimates.** County-loan maturities are often 10+ years wide. The backtest and calibration harness doesn't exist yet.

**Income.** Coverage, DSCR, and the refinance gap use a reported NOI only. A blank park is not filled with a statewide rent, 90% occupancy, or a 40% expense ratio. Those two rates appear only as labeled defaults on the underwriting form.

**Product gaps that are still open:**
- Owner contact discovery is still the assessor mailing address, the phone on the park, and contacts Jack types. Nothing is skip-traced.
- Entity resolution is a rule in `pipeline/mhdebt/entities.py`. It is not yet what the ingest matcher uses, and there is no map of who controls the LLCs.
- The ownership watch flags a park. It does not yet sweep the recorder overnight.
- Custom fields are saved on the park. They are not used in document reading or in Ask.
- One firm, Cooper Cardinal. There is no invite screen.
- Saved-view counts do not alert when a new park enters the view.
- The offer is a printable page, not a Word file. Document quotes are accepted text, not a PDF viewer.

**Shipped since the October 30 list:** Ask, the Today desk, saved views, fit and cadence, buyer email drafts that do not send, the copilot panel, in-app help, the park audit, and the failed-run log.

## 6. Accounts and secrets

**Done:**
- the GitHub repo
- the Supabase project, with the schema through `20261030000012` applied
- the Actions secrets `DATABASE_URL` and `ANTHROPIC_API_KEY`

**Still open:**
- Set up Vercel.
- Rotate the Supabase database password and the Anthropic key, then update `pipeline/.env`, `web/.env.local`, and the two Actions secrets.
- Optional accounts, not created: Census, the Maricopa assessor token, CourtListener. FRED is a public CSV and needs no key. `SEC_USER_AGENT` is an Actions variable; the workflow already has a fallback.

## 7. Related project: Beacon

Beacon (`github.com/aramoski1/Beacon`, public) is Alec's AI-native commercial real estate CRM for brokers, built under Lantern. It runs on Next.js 16, Supabase and Claude, uses South Florida county appraisers plus Massachusetts, and gets entity data from Sunbiz.

The buyer desk now has its own versions of the Today list, Ask, saved views, field locks, fit and cadence, email drafts, a copilot that answers from the loaded rows, page guides, and a failed-run log. Beacon still has these, and they were not copied:

- leases, tours, and commission tracking
- a Sunbiz scrape, including the curl workaround
- custom fields that flow into document extraction
- a live recorder sweep and a widening assessor sale search
- a PDF viewer that jumps to a citation
- per-teammate sharing and an invite flow
- saved-view counts that alert when a new property matches

See `docs/BEACON_PORT.md` for what transferred and what was left out.
