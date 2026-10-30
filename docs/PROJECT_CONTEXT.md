# Project context: Park Debt Tracker for Cooper Cardinal

Paste this at the start of a new chat. It covers the client, the product, the code, the data, what works and what doesn't, as of October 30, 2026.

---

## 1. The client and the goal

**Cooper Cardinal & Company** (coopercardinal.com) is a Phoenix firm run by **Jack Cardinal**.
- It buys and operates mobile home parks (MHPs) and RV parks for **its own portfolio**. It already manages roughly 30–40 parks.
- It is **not an acquisitions broker**. Every feature should help a principal decide which parks to pursue, what to pay, how to finance them, and how to work the deal. It should not help someone list or sell parks for others.

**Who is building it.** Alec is building this through Vertical Frame (verticalframe.ai, an AI-native software company for trades and physical industries). It came out of a discovery call in October 2026. Of the ideas raised, Jack was most interested in a **debt and financing tracker**: find parks whose owners face a loan maturity, a refinance at much higher rates, or distress, before the park is listed.

**The thesis.** Many park owners took loans at 3–5% in 2016–2021. Those loans mature into 6–8% money. An owner who can't cover the refinance gap is a motivated seller. Paid tools (Trepp, TreppWire, CRED iQ, Real Capital Analytics) sell this signal for CMBS loans. We rebuild it from free public data for **all** park debt (bank, CMBS, agency, SBA, seller carry), starting with **Arizona**.

## 2. Stack and where the code lives

- **Repo:** `github.com/aramoski1/mh-debt-tracker` (private). Main branch, about 12 commits.
- **Database:** Supabase project `park-debt-tracker` (ref `mlwseriuekgimfzqxzsd`, us-west-1). Migrations live in `supabase/migrations/`, and row-level security is on for every table.
- **Pipeline:** Python 3.11, in `pipeline/mhdebt/`.
  - The CLI is `mhdebt`: `ingest`, `build`, `extract`, `model`, `run`, `top`, `probe`, `holdout`.
  - Every web request goes through `PoliteClient`, which handles per-host rate limits, retries and a cache.
  - A nightly GitHub Action (`.github/workflows/pipeline.yml`) runs at 09:17 UTC. CI tests run against a Postgres service.
  - Python, because the data work (EDGAR XML, spreadsheets, fuzzy matching, statistics) is easier there, and the web app only reads from the database.
- **Web app:** `web/`, built on:
  - Next.js 15.5 (App Router) with React 19, `@supabase/ssr`, Tailwind 4 and design tokens in `web/app/tokens.css`
  - MapLibre for maps, TanStack Table + Virtual for the prospect table, Radix for dialogs, popovers and tooltips, Recharts for charts
  - the Anthropic SDK
- **Hosting:** Vercel, not yet deployed. Demo mode (`NEXT_PUBLIC_SUPABASE_URL=demo`) serves fictional data from `web/demo/*.json`.
- **Editor:** Cursor. Project rules are in `.cursor/rules/*.mdc` (`project`, `new-source`, `web`), and `BUILD_GUIDE.md` is the setup walkthrough.
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
- Comes from the HIFLD mobile home park list, plus park-use parcels from county assessors (Maricopa PUC 0840–0899, plus Pima). Joined by spatial and name matching (`match.py`, with a contradiction gate so different parks aren't merged).
- About **2,249 Arizona parks** are scored. Maricopa has 759, Pima 595, then Yuma, Pinal, Yavapai and Mohave.

**Loans** (`loans`):
- **SEC EDGAR CMBS:** the 10-D EX-102 asset tapes (property type `MH`) give balance, rate, maturity, NOI and DSCR. Portfolio loans are split across parks by their share. A loan is marked paid off when it drops out of the tape.
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
| `/parks/[id]` | **Park page.** Score and why, maturity range, loan history, documents, notes (Claude turns them into follow-ups), the operating figures form, the underwriting desk, and print. |
| `/pipeline` | Deal stages (Target, Contacted, In conversation, Underwriting, LOI, Due diligence, Closed, Dead) plus the buy-box form. |
| `/rates` | **Rate desk.** Treasury tenors, SOFR, prime, the CMBS spread, Arizona unemployment, and charts. |
| `/signals` | Tabs: FHA, Form D, filings, distress, sales, owners. |
| `/markets` | Counties ranked by number of parks. |
| `/owners`, `/owners/[id]` | Recorded owner names that hold more than one park, and each owner's parks. |
| `/portfolio` | Cooper Cardinal's own parks. |
| `/alerts` | Maturity windows, distress, score jumps. |
| `/admin`, `/freshness` | Admin page and source freshness log. |
| `/styleguide` | Internal component demo page. |
| `/login` | Email sign-in. |

- **Shell:** a left nav plus a ⌘K command palette. The palette only handles navigation and searching prospects by name.
- **Components** (`web/components/ui/`): Shell, Drawer, ScorePill, Charts, Bits, TabClient, PrintButton.
- **API routes:** `alerts`, `buy-box`, `deals`, `notes`, `operating`, `portfolio`, `underwriting`.

## 5. Honest weaknesses (from `docs/AUDIT.md`)

**Thin coverage:**
- 34% of parks have an owner.
- 13% have any loan.
- 2% have a reported maturity on an open loan.
- 0% have operating figures.

**Low scores.** The live maximum is about 50 and the average about 4, because a park with no loan earns almost no points.

**Missing distress data.** The recorder job only reads the documents right after each parcel's last deed, so it misses later trustee sales, lis pendens and refinances. The fix is a sweep by document code and date.

**Wide maturity estimates.** County-loan maturities are often 10+ years wide. The backtest and calibration harness doesn't exist yet.

**Assumed income.** Refinance gaps assume $700 a site, 90% occupancy and a 40% expense ratio, unless a CMBS NOI is reported.

**Product gaps:**
- No AI copilot.
- No natural-language search.
- No saved views or smart lists.
- No customizable dashboard.
- No custom fields.
- No owner contact discovery beyond assessor mailing addresses and the 28% of parks with a phone number.
- No entity resolution (who controls the LLCs).
- No outreach drafting.
- No cadence or follow-up engine beyond alerts.
- No ownership-change watch.
- No in-app help.
- Single user.

## 6. Accounts and secrets

**Done:**
- the GitHub repo, with the Claude GitHub app installed
- the Supabase project, with the schema applied

**Still open:**
- Add `ANTHROPIC_API_KEY`.
- Set up Vercel.
- Add the GitHub Actions secrets: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `FRED_API_KEY`, `SEC_USER_AGENT`.
- Reset the Supabase database password.
- Optional free keys: FRED, Census, the Maricopa assessor token, CourtListener.

## 7. Related project: Beacon

Beacon (`github.com/aramoski1/Beacon`, public) is Alec's AI-native commercial real estate CRM for brokers, built under Lantern. It runs on Next.js 16, Supabase and Claude, uses South Florida county appraisers plus Massachusetts, and gets entity data from Sunbiz.

It is much further along on the product layer:
- a Copilot
- natural-language search with smart lists
- a customizable "command center" dashboard with a ranked Today desk
- custom fields that flow into AI extraction
- field-level provenance locks
- owner portfolio and entity graphs
- an ownership-change watch
- outreach drafting with QA
- cadence follow-ups and nudges
- deal kanban and forecast
- a document review UI with citations that jump to the PDF
- in-app page guides
- error and ingestion logs
- firm multi-tenancy

The next step is to port everything useful from Beacon into the tracker, adapted to a park **buyer** working debt and distress (see the companion prompt).
