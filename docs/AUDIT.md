# Audit: from a call list to an acquisition engine

Date: 2026-10-30. Counts are from the live database that morning, Arizona only. The demo app was clicked through at `http://localhost:3010` (prospects, a 12-month / score-40 filter, a park page, alerts). Pipeline tests: 39 passed, 2 skipped. Nothing below is a proposal to invent a field.

The product today ranks owner pressure for a broker. Cooper Cardinal is buying and operating parks. Those are different jobs. The list can tell you who might be uncomfortable. It cannot tell you what to pay, how you would finance it, or whether it sits next to a park you already run.

## 1. Data coverage

2,249 Arizona parks are scored. The score is not a coverage rate.

| Fact | Parks | Share of 2,249 |
| --- | ---: | ---: |
| On the federal HIFLD list | 1,571 | 70% |
| Owner of record attached | 760 | 34% |
| Any loan row, including paid off | 290 | 13% |
| Open loan (active or foreclosure) | 254 | 11% |
| Open loan, maturity reported | 48 | 2% |
| Open loan, maturity estimated | 177 | 8% |
| Open loan, no maturity at all | 29 | 1% |
| No loan row | 1,959 | 87% |
| Phone number | 633 | 28% |
| Name still "Park at {address}" | 497 | 22% |
| Operating figures (rent, vacancy) | 0 | 0% |

Of the 254 parks with an open loan, 177 (70%) have only an estimated maturity, 48 (19%) have a reported date, and 29 (11%) have neither.

Open loans by source:

| Source | Status | Maturity on the loan row | Loans |
| --- | --- | --- | ---: |
| County recorder | active | unknown | 217 |
| County recorder | refinanced | unknown | 65 |
| CMBS | active | reported | 33 |
| CMBS | active | unknown (maturity date is null) | 39 |
| SBA | active | reported | 21 |
| SBA | paid off | reported | 43 |

Recorded documents: 235 deeds of trust and 47 mortgages. Zero notices of trustee sale, lis pendens, liens, or judgments. The recorder job only reads the few numbers after each parcel's last deed, so it catches the purchase loan and misses later distress and most refinances.

Geography of the park list: Maricopa 759, Pima 595, then Yuma 168, Pinal 166, Yavapai 90, Mohave 72, and smaller counties down to Apache and Santa Cruz. Loan documents exist only where Maricopa's deed-adjacent lookup or a statewide SBA/CMBS file hit. Pima parcels are loaded. Pima recorder exports are not.

Scores on the live list: maximum 50.5, average 4.1. None are 60 or higher. Five are 45 to 60. Sixty-two are 30 to 45. The other 2,182 are under 30, because a park with no loan gets almost no points.

What is missing, in the order it changes a bid:

1. A maturity you can quote. Reported dates exist for 48 open loans. County loans are a distribution, often many years wide.
2. Distress after the purchase: trustee sales, lis pendens, tax delinquency, liens. None of that is in the database.
3. Income. Every refinance gap on a county or SBA loan uses $700 a site, 90% occupancy, and a 40% expense ratio. Zero parks have an entered rent roll. CMBS loans that carry a reported NOI do use it.
4. Agency loan tapes. The Fannie and Freddie importers exist and have loaded nothing, so there is no measured agency spread and no assumable agency loan flagged.
5. Price. No sale comps, no cap rate, no offer.

## 2. Accuracy

### Maturity

`maturity.py` spreads a loan across typical terms for that lender type. A community bank is weighted toward 5 years; an agency loan toward 10; SBA toward 25 years fully amortizing. A modification restarts a short extension. If the loan is still open past a candidate date, some probability stays on "already past due." The app shows one likely date plus a p10–p90 range.

Ways this is wrong:

- The priors are assumptions, not frequencies counted from Cooper Cardinal's closings or from the reported loans already in the database.
- The county loan's own `maturity_basis` stays `unknown`. The estimate lives on `maturity_estimates`. A query on the loan row alone understates how many dates are estimated.
- 39 active CMBS loans have a null maturity date even though EX-102 usually publishes one. That is a parse gap until a fixture from one of those filings shows the field was absent. Unverified which filings.
- A 15-year range (the demo park shows August 2018 to August 2033) cannot support an offer. The label says estimated. The screen still treats it as "next maturity."

Validation to build before tuning the priors: hide the maturity on every CMBS and SBA loan that has one, estimate from origination date and lender type only, and report the share whose true date falls inside p10–p90 and inside 12 months of the likely date. Calibration: among loans whose `prob_24m` was about 0.7, about 70% should have matured inside 24 months. That harness does not exist. The skipped database test does not do it.

Backtest to build after that: recompute scores using only documents recorded before a past date, then see how many top-ranked parks show a later sale on the assessor (`parcels.last_sale_date`) or a later release. Do not claim a hit rate until that runs.

### Lender type

Classification is a name rule, then a fuzzy match to FDIC at a 90 cutoff. Title companies are stripped. Failures: a private lender with a bank-like name, a CMBS trust labeled as the lender (correct for the score's "CMBS" bucket, wrong if you want the originator), and any credit union the NCUA file does not cover. FDIC financials feed the CRE-concentration points. Banks without a call-report match get no concentration points and look safer than they are.

### Matching

HIFLD attaches to an existing park only inside 150 meters when the address does not contradict. That linked 195 parks on the load and left 497 "Park at …" rows beside a federal park that did not win the match. Those are double counts or unnamed parks. A buyer can call the wrong owner or call twice.

Loan-to-park matching uses a 0.70 score on name, address, zip, and distance. A weak match is stored with `match_confidence` and is not surfaced as a warning on the park page.

### Score

Five parts, 100 points: maturity 35, rate shock 20, refinance gap 20, lender 10, owner 15.

The refinance gap is the number a buyer would misuse. Income is `sites × $700 × 12 × 0.90 × 0.60` unless the loan has reported NOI. `REFI_LTV_CAP` is 0.75 in `scoring.py` and is never applied. The comment says the proceeds are the lower of the DSCR test and the LTV cap. The code uses only the DSCR test. There is no cap rate and no value, so "equity needed" is not the cash to refinance against a real appraisal. It is the gap against a restated balance at a 1.25 DSCR.

Rate shock uses the 5-year Treasury for every term, plus a fixed spread (agency 1.80, community bank 2.75, debt fund 4.00, life company 1.70). Those spreads are comments in `rates.py`, not medians from loans. The seller-financing floor is 5%. If FRED fails, a handwritten yearly table is used, including 2026 at 3.85, which is not a print.

Owner points use the assessor's last sale as "held since." Entity transfers look like a new owner or a long hold, depending on which deed was last.

Nothing in the score is "does this fit a buy box" or "what do I earn if I buy it."

## 3. Rates

Today's financing estimate is a monthly average 5-year Treasury (FRED series DGS5, cached a day) plus the table above. It is not a quote.

A lender on a park loan prices off a Treasury or SOFR matched to the term, plus a spread that moves with the loan size, the DSCR, and whether the paper is agency, CMBS, bank, or bridge. A 10-year agency loan is not the 5-year Treasury plus 180 basis points. A bank quote to the seller and the loan you would put on at closing can differ by a point.

What is good enough to start: the 5-year series is a real daily print, averaged by month. The New York Fed SOFR file was read live this session (SOFR 3.94% on 2026-10-28). FRED's DGS10 CSV returned HTTP 500 from the review client the same day, so that series is unverified until `mhdebt probe` hits it. The spreads are the weak half. The honest fix is to measure them from loans we already store: CMBS and SBA note rate minus the Treasury on the origination date, median by lender type and term, with the sample size on screen. Agency spreads wait until a DUS Disclose or K-Deal file is actually imported. No lender web page was cleared for scraping.

Jack's own quotes should override the median. That is an admin entry, not a new source. Do not add a paid rate service.

## 4. Acquisition workflow

Walked as a principal, not a broker.

**Who to call today.** The home page is a score sort, four counts, and eight "calls worth making" (score at least 40, due inside a year, or a foreclosure, and no note in 60 days). On the live book that list is short because almost nobody scores 40. It does not know your buy box, your existing 30 to 40 parks, or whether the debt is assumable. The phone is there for 633 parks.

**Is it worth buying.** The park page has the pressure score, a maturity range, loan history, documents, notes, and an operating-figures form (rent, vacancy, RV share, land tenure). The form is the right slot for income. It is empty in the database. There is no price per site, no comp, no value range, and no "walk away" test. The map on the list sits on top of the first call-list links, so a click from the list misses the park.

**How to finance it and what you earn.** Not in the product. No acquisition rate separate from the seller's refinance rate. No assumption case. No seller-financing case. No cash-on-cash, DSCR on your loan, equity check, or five-year IRR. No "what the seller nets."

**After the call.** Notes extract a follow-up with Claude. Alerts cover maturity windows, distress, and score jumps. There is no stage (target, contacted, LOI, dead), no saved search, no reminder, and no owner page that lists every park that owner holds. `owner_park_count` is a number, not a dossier.

Generating an offer letter now would put an estimated maturity and a $700 rent in front of an owner. Do not build the letter until the underwriting screen can show provenance on every figure and a person can edit the price. The letter is phase 3 item 7, and it should wait.

## 5. UI

Clicked in demo mode: prospects, filters (12 months and minimum score 40 returned 5 parks), Paradise RV Resort (score, before-you-call, operating form, notes, a trustee-sale document), and alerts (three maturities and one distress, each linked).

What a buyer would not trust:

- The real book and the demo book do not look like the same market. Demo scores reach the 70s with a foreclosure story. The live maximum is 50.5 and the average is 4.
- The maturity control says "next maturity" beside a range a decade wide, and the rate line does not say the spread is an assumption.
- There is no price. An investor terminal leads with price, debt, and basis.
- The list and the park are different pages. Sizing a park loses the list.
- The map overlays the call list, so the first links are not clickable until you scroll.
- Two thousand rows, no saved columns, no keyboard jump, CSV only.
- Red and burgundy are used for the brand, for high scores, and for distress. Distress does not have its own signal.
- Phone width was not checked this session.
- Cooper Cardinal's black header and gold rule are in place. The logo is type, not the firm mark. Contrast of gray `#787d85` on white is the one to check against WCAG AA before calling the UI done.

## 6. Code health

- Jobs are idempotent upserts. County loan status is still rebuilt only by replaying documents. That rule is intact.
- `score_parks` holds one transaction across every park. The last full rescore of these 2,249 parks took on the order of seven minutes. Commit in batches.
- `REFI_LTV_CAP` is unused. The comment and the code disagree.
- CMBS `modified` and the reporting period sit in `loans.raw`. Payment status, NOI, DSCR, occupancy, rate, and balance are real columns and should be what the park page prefers over the estimate.
- Row-level security is on, including `park_operating`. Authenticated users can read everything. Notes and manual operating rows can be inserted only as oneself. The pipeline uses the database role and bypasses RLS. That matches a single team. It is not a per-deal permission model.
- Tests do not touch the network. The end-to-end database test skips unless `TEST_DATABASE_ADMIN_URL` is set. There is no backtest.
- README still says 33 tests. The suite is 39 passed and 2 skipped.
- A second Next process in this repo shares `.next` and has already 404'd a route. Run one dev server.

## What to build, and what to drop

Worth it, in this order:

1. Measure spreads from the CMBS and SBA loans already stored, and show sample size and as-of. Add the Treasury tenors and SOFR beside the 5-year, each with a probe and a fixture.
2. Pull Maricopa distress by document code and date on the recorder API we already use, then match to parks. Probe the codes first. Do not point the job at `/documents/search` by owner name; that parameter is ignored.
3. Surface reported NOI, DSCR, rate, and payment status on the park page, and apply the LTV cap the comment already describes. Label every figure reported, document, or estimated.
4. An owner page: every park, every loan, one mailing address.
5. A buy box and a second score for fit, including distance to parks you operate. That requires you to mark the 30 to 40 managed parks. The table for that does not exist yet.
6. Underwriting on the park: price from comps once a deed-sale feed is real, financing cases (new loan, assumption, seller note), returns. Save edits on the park.
7. Deal stages and a call list ranked by motivation and fit.

Not worth it yet:

- Owner letters and LOIs, until the underwriting numbers are sourced.
- NAIP imagery and a vision count of vacant pads, until it is checked against parks with a known site count. Optional later.
- Scraping Crexi, CoStar, LoopNet, MHVillage, Mobile Home Park Store, the Arizona Corporation Commission site (`robots.txt` disallows all), or the MHI community database (license to view only; no storage without written permission).
- A national county build. Yuma, Pinal, Yavapai, and Mohave are the next counties, after Maricopa distress works.

Paid items that would move a bid, with no integration: Datacomp / JLT rent surveys (Phoenix MSA book listed at $465 for January 2026, 106 communities). Write those up in `docs/PAID_UPGRADES.md` only if you decide to subscribe. Do not scrape them.
