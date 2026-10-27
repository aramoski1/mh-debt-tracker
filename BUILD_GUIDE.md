# Park Debt Tracker: Build Guide

This guide walks through standing up the debt and financing tracker for Cooper Cardinal from scratch, using only free data. Do the steps in order. Each step ends with a check so you know it worked before moving on.

What you end up with: a nightly pipeline that finds every mobile home and RV park in Arizona, attaches every loan it can find, estimates when each loan comes due, scores how much pressure each owner is under, and a web app where Jack's team works the list.

---

## How it fits together

```
 FREE DATA SOURCES                    PIPELINE (Python, GitHub Actions nightly)        APP (Next.js on Vercel)
 ─────────────────                    ──────────────────────────────────────────       ───────────────────────
 HIFLD park list ───────────┐
 Maricopa / Pima parcels ───┤──► parks + owners ─┐
 SEC EDGAR CMBS (EX-102) ───┤                    ├─► match ─► loans ─► maturity  ─► score ─► Supabase ─► map, ranked list,
 Fannie DUS / Freddie MSIA ─┤──► loans ──────────┘              ▲     estimate     alerts   (Postgres)   park page, call notes
 SBA 7(a)/504 FOIA ─────────┤                                   │
 Maricopa recorder API ─────┴──► recorded documents ─► Claude reads the PDF (maturity, rate, lender)
 FDIC call reports ─────────────► lender size + CRE concentration
 FRED 5-yr Treasury ────────────► rate then vs. now
```

| Folder | What's in it |
| --- | --- |
| `supabase/migrations/` | The database: parks, parcels, owners, lenders, loans, recorded documents, estimates, scores, alerts, call notes, plus row-level security |
| `pipeline/mhdebt/sources/` | One module per data source |
| `pipeline/mhdebt/match.py` | Links loans and parcels to parks (name, address, zip, distance) |
| `pipeline/mhdebt/lenders.py` | Classifies lenders (community bank, agency, CMBS, seller financing...) |
| `pipeline/mhdebt/maturity.py` | Exact or estimated maturity dates with probabilities |
| `pipeline/mhdebt/docai.py` | Sends recorded loan documents to Claude and gets back terms with quoted evidence |
| `pipeline/mhdebt/scoring.py` | The 0 to 100 owner pressure score and the reasons behind it |
| `pipeline/mhdebt/jobs.py` | Each pipeline step, idempotent |
| `web/` | The Next.js app |

---

## Step 0. Get the project into Cursor (20 minutes)

### Accounts

1. **Supabase** (free tier is enough to start): a project named `park-debt-tracker`, region US West. Step 1 covers the setup.
2. **GitHub**: the private repo `aramoski1/mh-debt-tracker`.
3. **Vercel**: for the web app. Vercel's free Hobby plan is for non-commercial use; a client deployment should be on Pro.
4. **Anthropic API key**: for reading loan documents and structuring call notes.
5. **On your computer**: Cursor, Python 3.11+, Node 20+ and Git. In Cursor, install the extensions it suggests when the project opens (Python, Tailwind CSS, ESLint, PostgreSQL); they're listed in `.vscode/extensions.json`.

### Open it in Cursor

If the code is already on GitHub: in Cursor, open the Command Palette (Cmd+Shift+P on Mac, Ctrl+Shift+P on Windows) and run **Git: Clone**. Paste `https://github.com/aramoski1/mh-debt-tracker.git`, choose a folder, and click **Open** when it finishes.

If you're starting from the zip: unzip `mh-debt-tracker.zip`, then in Cursor choose **File > Open Folder** and pick the `mh-debt-tracker` folder. It's already a git repo with one commit. To put it on GitHub, open the terminal (Ctrl+` ) and run:

```bash
git remote add origin https://github.com/aramoski1/mh-debt-tracker.git
git push -u origin main
```

Cursor will ask you to sign in to GitHub the first time you push.

### Install everything

The fastest way: Command Palette > **Tasks: Run Task** > **Setup: install everything**. Or run it yourself in Cursor's terminal:

```bash
cd pipeline && python3 -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"
cd ../web && npm install
```

On Windows, activate with `.venv\Scripts\activate` instead of `source .venv/bin/activate`.

Then tell Cursor which Python to use: Command Palette > **Python: Select Interpreter** > choose the one in `pipeline/.venv`. Without this, Cursor's editor won't find the `mhdebt` package and will underline imports in red.

**Check:**
- In the terminal, `mhdebt --help` lists the commands.
- **Tasks: Run Task > Test: pipeline** shows 32 passing and 1 skipped. The skipped one is the end-to-end database test, which runs once Postgres is available (Step 9).
- **Tasks: Run Task > App: demo mode**, then open http://localhost:3000. You should see the prospects screen with fictional demo parks.

### How to use Cursor's agent on this project

The project ships with Cursor rules in `.cursor/rules/`. The agent reads them automatically, so it knows the architecture, the data sources, how to run tests, and the conventions (idempotent jobs, no network calls in tests, every new source gets a probe command). Useful prompts as you go:

- "Run the Maricopa probe and tell me whether `_doc_from_json` parses the response correctly. Fix it if not."
- "Add Pinal County as a source, following the pattern in `sources/maricopa.py`, with a probe command and tests."
- "Explain why park X scored 64, using the components in `park_scores`."
- "The Fannie export printed `no column found for ['maturity_date']`. Here's the header row: … Add the right aliases."

Keep each agent request to one step of this guide, run the tests after every change (**Test: pipeline**), and commit when they pass.

---

## Step 1. Connect to the database (10 minutes)

**Already done:** the Supabase project `park-debt-tracker` exists in your org (region West US, North California; project URL `https://mlwseriuekgimfzqxzsd.supabase.co`), and the schema in `supabase/migrations/20261027000001_init.sql` has been run: 14 tables, row-level security on every table, and the `park_overview` view.

What you still need to do in the Supabase dashboard:

1. **Set the database password.** It was generated when the project was created and wasn't saved anywhere. Go to **Project Settings > Database > Reset database password**, generate a new one, and store it in your password manager.
2. **Copy the pipeline connection string.** Click **Connect** (top bar) > **Session pooler**, copy the URI, and replace `[YOUR-PASSWORD]` with the password from step 1. That's `DATABASE_URL`.
3. **Copy the app keys.** Go to **Project Settings > API**. You need the project URL (above) and the `anon` public key.

Future schema changes go in new files in `supabase/migrations/`. Run them in the SQL Editor, or with the Supabase CLI (`supabase link --project-ref mlwseriuekgimfzqxzsd`, then `supabase db push`).

Then, in Cursor's terminal from the project root:

```bash
cp pipeline/.env.example pipeline/.env      # fill DATABASE_URL, ANTHROPIC_API_KEY, SEC_USER_AGENT
cp web/.env.example web/.env.local          # fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Open both files in Cursor and paste the values in. The pipeline reads `pipeline/.env` automatically whenever you run `mhdebt` from the `pipeline` folder. Both files are git-ignored, so keys never get committed. Don't paste keys into the Cursor chat.

**Check:** the Table Editor shows `parks`, `loans`, `recorded_documents` and the `park_overview` view.

---

## Step 2. Confirm the live sources before loading anything (20 minutes)

Some county endpoints are not formally documented. The probes print exactly what each source returns so you can confirm field names. Run them first, in Cursor's terminal from the `pipeline` folder with the virtual environment active (or **Tasks: Run Task > Probe: all sources**):

```bash
mhdebt probe maricopa       # distinct park use codes + one recorder document, raw and parsed
mhdebt probe pima           # PARCEL_USE values starting with 08
mhdebt probe fdic           # confirms the call-report fields used for CRE concentration
mhdebt probe cmbs --limit 3 # finds CMBS trusts and counts park loans in a few
```

What to look for:

- **Maricopa recorder**: the parsed output should show a `doc_type` other than `other`, a `recording_date`, and names. If the raw JSON uses different keys, adjust `_doc_from_json` in `sources/maricopa.py`.
- **Maricopa parcels**: codes in the 0840 to 0899 range.
- **Pima**: if park codes don't start with 084/085/089, set `PIMA_PARK_WHERE` in `.env` to the right filter.
- **FDIC**: every field should say `ok`. If one says `MISSING`, change it in `sources/fdic.py`.

If something doesn't parse, select the probe output in the terminal, add it to the Cursor chat (Cmd+L / Ctrl+L), and ask the agent to fix the parser and add a test using that response as a fixture.

---

## Step 3. Build the park universe (15 minutes)

```bash
mhdebt ingest hifld                      # ~ every MH and RV park in TARGET_STATES from the federal list
mhdebt ingest parcels --county maricopa  # adds parcels, owners of record, last sale date, and parks HIFLD missed
mhdebt ingest parcels --county pima
```

If the HIFLD mirror is down, download `mobile-home-parks-geojson.zip` from DataLumos (project 239601), unzip it, and run `mhdebt ingest hifld --geojson path/to/file.geojson`.

**Check:** in Supabase SQL Editor:

```sql
select count(*), count(owner_id) as with_owner from parks where state = 'AZ';
```

You want a few thousand parks for Arizona with owners on most of the Maricopa and Pima ones.

---

## Step 4. Load the published loans (exact maturity dates)

### 4a. CMBS (automatic, free)

```bash
mhdebt ingest cmbs
```

This reads EDGAR's quarterly index, finds each CMBS trust's latest monthly ABS-EE filing, streams its EX-102 XML, and keeps loans on manufactured housing (property type `MH`) plus RV parks coded as other/lodging/mixed use. Portfolio loans are split across all of their properties by site count (or value), so a park only carries its own share. When a loan drops out of a trust's monthly report, it's marked paid off. Partial-year income figures are annualized. The first run takes a while (hundreds of trusts); later runs skip trusts already processed that month.

### 4b. Fannie Mae and Freddie Mac (free, manual download, monthly)

1. Register at Fannie Mae's DUS Disclose. Run an advanced search with Specific Property Type = Manufactured Housing Community, state = AZ, and export to CSV.
2. Register for Freddie Mac Multifamily Securities Investor Access. Export loan-level data for K-Deals, filter to manufactured housing.
3. **Read both sites' terms of use** and confirm commercial prospecting use is allowed before loading.

```bash
mhdebt ingest agency --agency fannie  --file data/agency/fannie/dus_mhc_az.csv
mhdebt ingest agency --agency freddie --file data/agency/freddie/k_mhc_az.csv
```

The loader accepts many column spellings. If it prints `no column found for [...]`, add that header to `ALIASES` in `sources/agency.py`.

### 4c. SBA (free, manual download)

Download the 7(a) and 504 FOIA CSVs from data.sba.gov and run:

```bash
mhdebt ingest sba --file data/sba/foia-7a-fy2020-present.csv
```

This mostly finds RV parks (NAICS 721211). SBA loans fully amortize, so they don't create a balloon, but they give the exact origination date, lender and the operating business.

**Check:**

```sql
select source, count(*), count(park_id) from loans group by source;
```

Unmatched loans get linked or turned into new parks in the next step.

---

## Step 5. Pull county loan records

```bash
mhdebt ingest recorder --county maricopa
```

How it finds loans without a search API: each Maricopa parcel carries `DEED_NUMBER`, the recording number of the last deed. When a park is bought with a loan, the deed of trust is recorded right behind the deed, so the pipeline checks the next few recording numbers. That catches every financed acquisition for free.

To also catch **refinances, modifications, releases and foreclosure notices** after the purchase, it needs a name search. Because a name search returns documents without a parcel, results are attached to a park only when that's unambiguous: the owner is a company or trust (people's names collide with strangers') that owns exactly one tracked park. Everything else is saved unlinked so it can be reviewed rather than guessed onto the wrong park. Open any document on recorder.maricopa.gov with your browser's developer tools on the Network tab, run a name search, and copy the JSON search URL the page calls. Put it in `MARICOPA_RECORDER_SEARCH_URL`; the code sends `name`, `beginDate`, `endDate`, `pageSize` and `pageNumber` (adjust in `Recorder.search_by_name` if the page uses different parameter names).

**Pima** has a free portal but no API. Search by owner name for deeds of trust, releases and modifications, export the results, and load them:

```bash
mhdebt ingest recorder-export --county pima --file pima_results.csv
```

Then turn the documents into loans and enrich everything:

```bash
mhdebt build
```

`build` links published loans to parks, creates loans from deeds of trust (picking the lender out of the names and skipping title companies), applies releases, marks refinanced loans, flags trustee sale notices, classifies every lender against the FDIC list (with bank size and CRE concentration), and geocodes parks with the free Census batch geocoder.

**Check:**

```sql
select l.status, ld.kind, count(*) from loans l left join lenders ld on ld.id = l.lender_id
where l.source = 'county' group by 1, 2 order by 3 desc;
```

---

## Step 6. Read the loan documents with Claude

About 59% of recorded commercial loans have no maturity date in the county's index, but many state it inside the document. This step sends each deed of trust to Claude, which returns the lender, amount, note date, maturity date, rate, balloon terms and the parcels, each with the exact words and page it came from. A maturity date is only accepted if Claude quoted the text it came from.

```bash
mhdebt extract --limit 25    # start small and read the results
```

Look at a few in Supabase (`recorded_documents.extracted`) and compare against the PDF. When you're satisfied, the nightly run handles up to `MAX_DOCS_PER_RUN` documents each night. Each page costs roughly 1,500 to 3,000 tokens plus the page image, so a 20-page deed of trust is on the order of 50,000 to 80,000 input tokens; check current Anthropic pricing and set the cap to match the budget.

---

## Step 7. Estimate maturities and score

```bash
mhdebt model
mhdebt top --n 30
```

**How a maturity is decided:**

1. A published date (CMBS, agency, SBA term) or a date stated in the document is used as-is.
2. Otherwise the model looks at the lender type and the date the loan was recorded, and spreads probability over that lender's typical terms (community banks: mostly 5 years, some 3, 7 and 10; seller financing: 5 to 10; and so on).
3. A recorded modification restarts the clock with a short extension.
4. Loans that fully amortize by maturity (SBA, many life company loans) get little pressure because there's no balloon to refinance.
5. A loan with no recorded payoff becomes less likely to still be open the longer it runs past each candidate date. The "lost" probability is shown as the chance it was already repaid without a release in our data. This keeps a 2010 loan from looking past due. Loans that still appear in a current CMBS or agency report are known to be open and don't get this discount.

County loan statuses (active, released, refinanced, foreclosure, paid off) are rebuilt from the recorded documents in date order on every run, so a cancelled trustee sale clears the foreclosure flag, and notices older than two years with nothing after them are treated as cured.

**The score (0 to 100):**

| Part | Points | What drives it |
| --- | --- | --- |
| Loan coming due | 35 | Probability it comes due within 12 or 24 months, or is already past due; 35 if a trustee sale notice was recorded |
| Rate shock | 20 | Today's refinance rate minus the rate they borrowed at (reported, or estimated from the 5-year Treasury plus a spread by lender type) |
| Refinance gap | 20 | Debt coverage at today's rate. Uses reported income for CMBS/agency loans, otherwise sites × market lot rent × 90% occupancy × 60% margin. Shows the equity needed to refinance |
| Lender pressure | 10 | Lender's CRE loans above 200% or 300% of capital, community bank or debt fund, CMBS delinquency, foreclosure |
| Owner profile | 15 | Held 8+ or 15+ years, owner lives out of state, individual or family trust, owns a single park |

All the assumptions are named constants at the top of `rates.py`, `maturity.py` and `scoring.py`. Tune them with Jack's banking contacts (typical local terms and spreads) and with Cooper Cardinal's own rent rolls (lot rents by market).

**Check:** the top of `mhdebt top` should be parks a broker would agree are worth a call. Pick five, open their documents, and sanity-check the story the score tells.

---

## Step 8. Deploy the app

Run **Tasks: Run Task > App: dev server** (or `cd web && npm run dev`) and open http://localhost:3000.

**Try it without a database first:** set `NEXT_PUBLIC_SUPABASE_URL=demo` in `.env.local` and the app runs on fictional demo parks (labeled as such in the header). Regenerate demo data with `python pipeline/scripts/make_demo.py <postgres url> web/demo/data.json`.

For real use:

1. In Supabase **Authentication > Providers**, keep Email on and leave new sign-ups allowed. The login page emails a link; the first time someone uses an address, that creates their account.
2. Under **Authentication > URL Configuration**, add your Vercel URL and `https://<your-domain>/auth/callback`.
3. Import the repo in Vercel, set the root directory to `web`, and add the environment variables from `web/.env.example`.

What the team gets:

- **Prospects**: map plus ranked list, filterable by state, park type, site count, maturity window, lender type and whether the date is known or estimated. Filters live in the URL, so a saved view is just a bookmark. Export to CSV for call sessions.
- **Park page**: the score broken into its five parts with the reason for each, the next maturity with its likely range, every recorded loan and its status, the recorded documents with links to the PDFs, and call notes.
- **Call notes**: a broker types or dictates a note. Claude pulls out the outcome, follow-up date, lender, maturity, rate, balance and motivation and saves them with the note.
- **Alerts**: new loans recorded on tracked parks, foreclosure notices, loans entering their last 12 months, and score jumps of 15+ points.

---

## Step 9. Automate it

Push to GitHub, then in the repo's **Settings > Secrets and variables > Actions**:

- Secrets: `DATABASE_URL`, `ANTHROPIC_API_KEY`
- Variables: `SEC_USER_AGENT` (for example `Vertical Frame research alec@verticalframe.ai`), `TARGET_STATES` (`AZ`), `MAX_DOCS_PER_RUN`, `MARICOPA_RECORDER_SEARCH_URL`

`.github/workflows/pipeline.yml` runs `mhdebt run` every night at 2:17 AM Arizona time and can be run by hand from the Actions tab. `ci.yml` runs the tests, including the full database test against a real Postgres, on every push.

The manual sources (Fannie, Freddie, SBA, Pima exports) only change monthly: download them on the first of the month and run the `ingest` commands, then `mhdebt build && mhdebt model`.

To run the database test locally, start any Postgres 16 and set `TEST_DATABASE_ADMIN_URL`, for example `postgresql://postgres:postgres@localhost:5432/postgres`.

---

## Step 10. Prove it works before showing Jack

1. **Backtest.** Run `mhdebt model --today 2024-10-01`. Take every park that scored 60+ as of that date and check how many sold, refinanced or recorded a foreclosure notice in the two years after. Compare against parks that scored under 30. If the high scorers didn't move more often, tune the weights. One caution: this uses today's records, so a release recorded after the backtest date already shows the loan as released. For a clean test, run it against a copy of the database with documents recorded after that date removed.
2. **Ground truth from Jack.** Ask for 10 parks where he knows the actual loan terms (including the Tucson listing). Compare the tracker's lender, amount and maturity against what he knows.
3. **Coverage report.** Count Arizona parks with an exact date, an estimated date, and no loan found. That's the honest answer to "how much of the market can we see."

---

## What to build next

- **More counties and states**: each county is a new `sources/<county>.py` with a parcel function and a recorder function. Pinal, Yavapai, Mohave and Yuma cover most of the rest of Arizona.
- **Owner contacts**: the Arizona Business Center (which replaced eCorp in January 2026) lists each LLC's statutory agent and members; there's no API, so this is a manual lookup or a paid data provider.
- **Call list generator**: a morning list per broker ranked by score, freshness of the signal, and time since last contact.
- **Learning weights**: once there are a few hundred call outcomes in `activities`, fit the score weights to which calls actually turned into listings.

## Known limits

- County data shows loans recorded against the land. Parks owned free and clear, or financed by an unrecorded note, show "no loan found"; they still score on ownership signals.
- Estimated dates are probabilities. The app says "Estimated" next to every estimated date and shows the likely range; treat the score as a reason to call, not a fact to quote to an owner.
- Several county endpoints are undocumented and can change. The probes in Step 2 are how you find out quickly.
- Skip-traced phone numbers fall under do-not-call rules; scrub lists before calling.
