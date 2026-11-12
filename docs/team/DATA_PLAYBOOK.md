# Data playbook

This is the data-scout's knowledge base. The full source list is in `DATA_SOURCE_CATALOG.md`. This file explains how to think: where paid products get their data, what "good" looks like, and how to measure it.

**Status of anything not yet verified with a live probe and a fixture:** unverified. Update this file whenever a probe proves or disproves something.

---

## 1. Dissecting paid vendors

Paid products mostly repackage public records, add matching and research, and sell speed. For each field we need, find the public origin.

| Vendor | What it sells | Where the data originates | Our path |
|---|---|---|---|
| **Trepp / TreppWire** | CMBS loan-level data: balance, rate, maturity, DSCR, occupancy, watchlist, special servicing, modifications, appraisal reductions. News on distressed loans. | - SEC ABS-EE filings since Reg AB II (2016): EX-102 asset data and EX-103 asset-related documents.<br>- 10-D distribution reports, whose EX-99.1 trustee/servicer statements carry delinquency, special-servicing and modification detail.<br>- 424B/FWP prospectuses with Annex A property-level tables.<br>- 8-Ks.<br>- Servicer watchlist commentary is CREFC investor reporting, mostly **not public**. Some reaches 10-Ds and rating-agency releases. | EX-102 is loaded. Parse EX-99.1 and Annex A fully. Fix the CMBS loans with a null maturity. |
| **CRED iQ** | Same CMBS data plus valuations and distress scoring. | The same SEC filings, plus rating-agency surveillance press releases (some free, e.g. Morningstar DBRS and Fitch press pages; KBRA surveillance needs a subscription). | Extract park loans from free press releases (store the summary and link, not a copy). |
| **Real Capital Analytics (MSCI)** | Sale comps: price, buyer, seller, financing. | - County recorder deeds.<br>- Arizona's Affidavit of Property Value (sale price is filed with the deed).<br>- Press releases.<br>- Broker announcements, plus research calls. | Assessor sale fields (Maricopa loaded; Pima has no price). Recorder deeds by document code. Broker and trade-press deal announcements, extracted with quotes. |
| **CoStar** | Ownership, sales, listings, contacts, tenants. | Assessor, recorder, state entity registries, listings, phone research. | Assessor + recorder + entity linking. **Never** use CoStar's site. |
| **ATTOM** | Property profiles, deeds, mortgages, foreclosure notices, tax status. | County assessor, recorder (deeds of trust, notices of trustee's sale, releases), and treasurer tax rolls. | The same county sources directly: recorder document-code sweeps, plus treasurer delinquency and lien lists. |
| **Reonomy** | Owner behind the LLC, mortgages, sale history. | Assessor, recorder, Secretary of State / Corporation Commission entity filings, UCC filings. | Assessor and recorder are already used. The ACC site can't be automated (robots.txt), so we use a manual link plus a paste-extract flow. UCC access at the AZ Secretary of State is unverified. |
| **Datacomp / JLT** | MH community rent and occupancy surveys. | Proprietary phone and site surveys. | **No public equivalent.** Use Census ACS lot-rent data (PUMS), REIT disclosures by state, and broker research PDFs (Northmarq, Marcus & Millichap) for context. Note the Phoenix book in `PAID_UPGRADES.md`. |
| **MHVillage / MHI database** | Community listings and attributes. | Operator submissions. | Off-limits (terms). Use HIFLD, OpenStreetMap, assessor use codes and EPA water systems to reconstruct park attributes. |
| **Yardi Matrix / bank data vendors** | Lender exposure. | FFIEC call reports (public) and HMDA. | The **FFIEC call reports** show each bank's commercial real estate concentration and nonperforming loans. They're a lender-stress signal for county loans by lender. Candidate for verification. |

## 2. What the product needs, and the best public origin of each

| Need | Primary public origin | Notes |
|---|---|---|
| Every park | HIFLD + assessor park-use parcels + OpenStreetMap + EPA water systems serving parks | Probe use codes county by county. Pinal showed no MH code last probe. |
| Owner of record | County assessor | Maricopa has a free token API. Ask before requesting the token. |
| Entities behind the owner | Assessor mailing address and name; signers and grantors on recorded deeds; CMBS borrower and sponsor in 424B; Form D issuers and related persons | Exclude professional registered agents before linking. |
| Every loan | Recorder deeds of trust, assignments, modifications, releases; SEC CMBS; SBA FOIA; HUD FHA; agency disclosure files (terms pending) | County loans have no maturity in the index. Get it from documents where images or text are free, or estimate it with an honest range. |
| Maturity accuracy | Reported dates on CMBS/SBA loans as ground truth | Build the holdout/calibration harness. Report coverage of p10–p90. |
| Distress | Recorder (notice of trustee's sale, lis pendens, cancellation), treasurer tax liens, bankruptcy (CourtListener; free account; ask first), EPA/ADEQ water violations, city code cases where terms allow, CMBS special servicing | **Sweep the recorder by document code and date, not by owner name.** The audit found the name search is ignored by the API. |
| Comps | Assessor sale prices; recorder deeds with affidavit price; REIT acquisition disclosures; broker deal announcements | Filter out non-market transfers (minimum price, deed type). |
| Rates | FRED, Treasury par curve, NY Fed SOFR, measured spreads from our own loans | Done. Add agency spreads once a term sheet or disclosure file is cleared. |
| Market context | Census ACS, BLS, HUD Fair Market Rents, Arizona OEO, Northmarq/M&M research PDFs | Context only. Never a park-level fact. |

## 3. Arizona counties to expand, in order

Maricopa (recorder + assessor, loaded) → Pima (recorder exports + parcels) → Pinal → Yuma → Yavapai → Mohave → the rest.

For each county, verify:
- parcel layer and park use codes
- owner and mailing fields
- sale price availability
- recorder search API or bulk index
- document codes for deed of trust, release, assignment, notice of trustee's sale, lis pendens
- whether document images or text are free
- treasurer delinquency lists
- terms of use

Record the results in `docs/team/sources/<county>-*.md`.

## 4. Accuracy, not just coverage

Every integration reports these numbers in `docs/COVERAGE.md` / `docs/ACCURACY.md`, before vs after:
- **Parks with:**
  - an owner
  - an entity group
  - any loan
  - an open loan
  - a reported vs document vs estimated maturity
  - a distress signal in the last 24 months
  - a comp within 25 miles in 3 years
  - operating figures
- **Match quality:** park → parcel match rate on a labeled set (top-1), and false-merge rate.
- **Maturity estimate calibration:** the share of hidden known maturities that fall inside p10–p90; Brier score on `prob_24m`.
- **Freshness:** days since each source's last successful run.

**Labeled set.** Hand-check at least 20 parks per county (APN, owner, loan, maturity where known) into `pipeline/tests/fixtures/labeled_parks.csv`. Without it, accuracy claims are opinions.

## 5. Method for a new source

1. State the gap and the metric it should move.
2. Find the origin. Check the catalog first, then search open-data portals (ArcGIS Hub, Socrata), agency download pages and FOIA libraries.
3. Read the terms and robots.txt. Record the decision and date.
4. Probe live. Save the fixture. Confirm the fields and codes.
5. Measure match rate and accuracy on the labeled set.
6. Write the source spec. Write the module, probe and tests.
7. Hand off to the developer with the before/after metric.
8. If it didn't move the metric, say so and remove it from the plan.
