# Data sources

Date: 2026-10-30. Verdicts are `built` (in the pipeline now), `deferred` (legal and useful, not built; this pass stops before the build), or `rejected`. "Verified" means a live response was read in this session or the pipeline already parses a saved fixture. Anything else is unverified and must get a `mhdebt probe` before a job depends on it.

Target geography is Arizona. Maricopa and Pima are the counties with parcel loads. Other Arizona counties are on the HIFLD list only.

## Already in the product

| Source | Access | What it adds | Terms | Verdict |
| --- | --- | --- | --- | --- |
| HIFLD Mobile Home Parks archive, `services2.arcgis.com/.../Mobile_Home_Parks_Archive/FeatureServer/0` | ArcGIS query, `STATE='AZ'` | 1,571 AZ parks: name, address, phone, units, type. NASA mirror is the fallback | Public ArcGIS item. PoliteClient | Built. Verified by the load (1,571 rows) |
| Maricopa Assessor parcels, `gis.mcassessor.maricopa.gov/.../Parcels/MapServer/0` | ArcGIS, PUC 0840–0899 | Owner, situs, last sale, deed number | County open GIS | Built |
| Pima parcels, `gisdata.pima.gov/.../LandRecords/MapServer/12` | ArcGIS, park use codes | Same for Pima. Codes 0810–0839 are subdivision lots and are excluded | County open GIS | Built |
| Maricopa Recorder API, `publicapi.recorder.maricopa.gov` | `GET /documents/{n}`, PDF preview, and `/documents/search` by `documentCode` | Purchase-money deeds of trust, plus NS (`N/TR SALE`) and LP (`LIS PEND`). A search of 14 days capped at 40 notices stored 40 documents on 2026-10-30. None matched a single-park entity owner, so they sit unlinked rather than on the wrong park | Public API, no key. Name search is not used: the endpoint ignores `name` | Built |
| SBA 7(a) and 504 FOIA, `data.sba.gov/dataset/7a-504-foia` | CSV download from the dataset page | Park NAICS loans from FY2010. 21 active AZ loans with reported maturity | Public FOIA files | Built |
| SEC EDGAR ABS-EE EX-102 | `form.idx` plus filing index JSON | CMBS park loans: rate, balance, maturity, NOI, DSCR, occupancy, payment status. 72 active AZ rows, 33 with a maturity date | SEC fair-access policy. User-Agent required. Already set | Built. 39 null maturities are an open parse question |
| FDIC BankFind, `api.fdic.gov/banks` | JSON, no key | Lender type and CRE concentration | Public API | Built |
| FRED DGS5 | `fredgraph.csv?id=DGS5`, no key | 5-year Treasury used as the only index | FRED/Federal Reserve public data | Built |
| Census geocoder | `geocoding.geo.census.gov` batch | Coordinates when a park has an address and no point | Census public | Built |
| OpenFreeMap | Style URL in the web env | Basemap only | Public tiles | Built |
| Fannie Mae DUS Disclose and Freddie Mac K-Deal / Optigo | Manual CSV after a human exports from the investor site | Reported maturity, rate, balance, DSCR. Also the only clean agency-spread sample | Registration-gated. Importers exist. Zero rows loaded. Do not automate the login | Built as importers. Data deferred until a file is dropped in |
| Pima recorder | CSV from a person using the Tyler portal | Deeds of trust the parcel deed-number trick does not see | No public API. Portal is not scraped | Built as `ingest recorder-export`. Zero files loaded |
| Operating figures | Manual form or `ingest operating` CSV | Rent, vacancy, sites, RV share, land tenure, owned-since. Scoring prefers these over the $700 guess | Figures you type or import from a file you have rights to | Built. Zero rows |
| HUD FHA active and terminated workbooks | `FHA-BF90-RM-A.xlsx` and `FHA-BF90-RM-T.xlsx` on hud.gov | A row is kept only when the section-of-act category contains "mobile home". On 2026-10-30 the active file had 2 such loans (California and Washington) and the terminated file had 135. None were in Arizona | Public files linked from the multifamily page. No key | Built. `mhdebt probe hud` |
| SEC Form D quarterly zip | The latest `*_d.zip` linked from the Form D data-sets page | Issuers whose name contains MHC, mobile home, manufactured housing, or RV park. 2026 Q3 had 10. An offering is not a maturity | SEC fair-access policy. User-Agent already set | Built. `mhdebt probe form-d` |
| EDGAR full-text search | `efts.sec.gov/LATEST/search-index` | One page of hits for two fixed park queries, stored as filing-index links. The filing body is not copied. A mobile-home-park 10-K search returned Sun Communities | Same SEC policy. ABS-EE for that phrase returned no hits on 2026-10-30 | Built. `mhdebt probe edgar` |
| ABS-EE and 8-K exhibit index | Existing `form.idx` plus `index.json` | EX-99 file names and URLs, a few filings a night. The exhibit is not downloaded. ABS-EE indexes checked on 2026-10-30 named EX-102 and EX-103, not EX-99. 8-K indexes from the search hits are checked for EX-99 | Same SEC policy | Built. `mhdebt ingest exhibits` |
| Google News RSS | `news.google.com/rss/search` for Arizona "mobile home park" | Up to 15 headlines and links. The article is not fetched | Public RSS | Built. `mhdebt probe news` |

## Rates and financing

| Source | URL | Fields | Frequency | Terms decision | Adds | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| FRED DGS5, DGS7, DGS10, DPRIME, BAA10Y | `fredgraph.csv?id=SERIES` | Daily yield, percent. DGS10 on 2026-10-28 was 5.05. 5-year was 4.85 | Daily history in `rate_prints` | Public series, no key. The 2026-10-30 review client 500 on DGS10 did not repeat | Index for the rate desk | Built |
| NY Fed SOFR | `https://markets.newyorkfed.org/api/rates/secured/sofr/search.csv` with `startDate` and `endDate` | Effective date and rate. 3.94% on 2026-10-29. The URL with no dates returns a header and no rows | Each business morning | Public markets API | Floating-rate index | Built |
| NY Fed SOFR averages | `https://markets.newyorkfed.org/api/rates/secured/sofrai/search.json` | `average30day`, `average90day`, `average180day`, `index`. On 2026-10-30: 3.89857, 3.77532, 3.71759, index 1.26495310 | Each business morning, from 2020-03-02 | Same public markets API. Probed 2026-10-30. The overnight CSV has these columns but they were blank on the days checked | Floating-rate averages. Not a park spread | Built. `mhdebt probe sofrai` |
| Treasury par yield curve | `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=YYYY` | 1-month through 30-year par yields, stored as `TSY_*`. On 2026-10-29 the 5-year was 4.78, the 10-year 4.98, the 30-year 5.32. 208 days in the 2026 file | Daily, ~3:30pm ET. Current year only | Treasury documents the XML feed as a public GET. Probed 2026-10-30 | Same-day official curve. FRED remains the long history for 5/7/10 | Built. `mhdebt probe treasury` |
| Fed H.15 | `https://www.federalreserve.gov/datadownload/Choose.aspx?rel=h15` | Constant-maturity Treasuries, prime, weekly and monthly averages | H.15 page showed a release dated 2026-10-29 | Federal Reserve public download | Same numbers as FRED | Deferred as a duplicate. Use only if FRED stays on 500 |
| Fed SLOOS, CRE standards | FRED `DRTSCLCC` | Net percent of banks tightening CRE standards. 6.7 on 2026-07-01 | Quarterly | Public FRED. Series id confirmed 2026-10-30 | Market-condition badge on the rate desk, not a park rate | Built |
| BLS shelter CPI | `api.bls.gov` public API v1, series `CUUR0000SAH1`, no key | US city-average shelter index. 432.092 in September 2026 | Monthly | BLS public v1 | Shown as an index. It is not written into lot rent or the score | Built |
| BLS Arizona unemployment | Same API, series `LASST040000000000003` | Statewide rate. 4.9 in September 2026, marked preliminary | Monthly | Probed 2026-10-30 | Shown on the rate desk. Not a park rate and not used in the score | Built |
| Spreads from loans already stored | No new URL. Note rate minus the matching-term Treasury (nearest of DGS5, DGS7, DGS10) on the origination date. A loan with no term stays on the 5-year and is labeled `term_unknown_uses_5y` | `market_spreads` is still the 5-year rollup by source and lender type. `loan_spreads` splits that by tenor and origination quarter. Used in the score when the 5-year sample is at least 8. See `docs/ACCURACY.md` | Each `mhdebt rates` | Our own statistic from public filings | Refinance rate with a sample size | Built. On 2026-10-30 the 5-year rollup was CMBS 2.64 points (33 loans) and four SBA lender types from 3.87 to 4.77 points. No Fannie or Freddie rows. FHA mobile-home mortgages are stored as source `hud` and are not part of this spread sample |
| Greystone and agency MHC term sheets | Marketing PDFs | Quoted spreads, max LTV, min DSCR | Not fetched | Terms not read. Do not download or parse them until a specific URL is cleared | A published grid Jack can compare with the measured median | Deferred. Not automated |
| MBA origination releases | mba.org press pages | Volume indexes, not loan-level rates | Monthly, often a PDF | Not a data feed. No loan tape found that is free | A headline, not a spread | Rejected for the Rate Desk |
| Lender rate pages | Bank and agency marketing sites | A quoted range, if published | Ad hoc | Not checked one by one. Do not scrape a page whose terms forbid it | Could sanity-check a spread | Rejected as a class until a specific page is cleared in this file |
| Jack's quotes | Admin form, no external call | Spread by product that overrides the median | When he updates it | Internal | The number you would actually sign | Deferred. Needs the Rate Desk table first |

## Seller distress

| Source | URL | Fields | Terms decision | Adds | Verdict |
| --- | --- | --- | --- | --- | --- |
| Maricopa recorder by document code and date | Existing search. `documentCode` NS and LP verified 2026-10-30 | Trustee sale (`N/TR SALE`) and lis pendens (`LIS PEND`). Search rows have empty names; the document endpoint has the parties | Same public API | Distress the deed walk never sees. Linked only when one entity owner of one park is on the document | Built, capped at 80 notices a night. The first 40 did not link |
| Pima recorder | `pimacountyaz-web.tylerhost.net` | Same document types | No API. Not scraped | Pima distress and refinances | Rejected as a scrape. Keep the CSV importer |
| Maricopa Treasurer tax liens | `https://treasurer.maricopa.gov/TaxLienInformation/` | Sale calendar, not a parcel-level delinquent file in what was public on that page | County site. No bulk delinquent roll found this session | Tax-delinquent parks | Deferred, unverified. Need a download or GIS field on the assessor layer. Do not invent an endpoint |
| Pima Treasurer | County treasurer site | Delinquent taxes | Not fetched this session | Same for Pima | Deferred, unverified |
| Other AZ county treasurers (Yuma, Pinal, Yavapai, Mohave first) | Each county's site | Delinquent list or tax status by parcel | Not reviewed one by one | Distress outside Maricopa and Pima | Deferred until Maricopa's feed is real. Then one county at a time, with robots.txt and a probe |
| CourtListener / RECAP | `https://www.courtlistener.com/help/api/` | Bankruptcy dockets by party name | Free API, requires a token | Owner-entity bankruptcies | Deferred. Ask before creating the token. No key in this pass |
| Arizona Corporation Commission | `https://ecorp.azcc.gov/robots.txt` | LLC status, statutory agent | `User-agent: *` / `Disallow: /` read this session | Dissolved owners and a second address | Rejected as a scrape |
| ADH park-closure notices | Statute 33-1476.01. Packet at `housing.az.gov` (FY21 PDF). Notices go to the director and the tenants | Park name, closure date, if the department publishes a list | The packet is a form, not a list. No public closure roll found | A park that must sell or empty out | Deferred, unverified. Ask ADH for the notice log before scraping housing.az.gov |
| City and county agendas (Phoenix, Mesa, Tucson) | Legistar and county clerks | Rezone and site-plan cases on park parcels | Varies by city. Not reviewed | Change-of-use ahead of a closure notice | Deferred. High noise. Only after closure notices have a real feed |
| EPA ECHO / SDWIS | `echodata.epa.gov/echo/sdw_rest_services.get_systems` then `get_qid`. Active Arizona systems, no key. Verified 2026-10-30: 1,721 systems, no coordinates on the row | Name, county, serious-violator flag, violation quarters | EPA open data | A park is linked only when the names still match after generic words are removed, the county does not contradict, and no second park is close. A one-word overlap is not a match | Built. Census income still needs a key and is not loaded |
| ADEQ | azdeq.gov facility search | State violations EPA may lag | Not fetched. Likely a search form | Same capital-need signal | Deferred, unverified. Reject if the terms or robots forbid automation |
| CMBS fields already parsed | EX-102 via the existing job | `payment_status` and NOI show on the loan row. `modified` shows when it is in `raw`. Defeasance is not parsed: no fixture has shown the tag | Already permitted | A CMBS loan in special servicing is visible. Prepayment lockout is not | Built for the fields already stored. Defeasance still waits on a fixture |
| Code enforcement | Phoenix and Tucson open data | Cases by address | Not reviewed this session | Habitability problems that force a sale or a capex line | Deferred, unverified |

## Value, upside, and fit

| Source | URL | Fields | Terms decision | Adds | Verdict |
| --- | --- | --- | --- | --- | --- |
| Park sale comps from recorded deeds | Maricopa parcel layer fields `SALE_PRICE` and `SALE_DATE`. 572 of 2,186 Maricopa park parcels already have a price. Pima's layer has no price field (checked 2026-10-30; the fields are docket and record date only) | Price, date. Price per site when the park has a site count | Same assessor API already in use | Shown on the park page as the assessor sale price | Built for Maricopa. Pima has no price to load |
| HUD Fair Market Rents | `https://www.huduser.gov/hudapi/public/fmr` | FMR by county and bedroom | Public, but the documented API uses a bearer token | A ceiling on what a park-owned home might rent for. Not lot rent | Deferred. Ask before registering for the token |
| Census ACS | `https://api.census.gov/data` | Income, rent burden, population | A keyless request on 2026-10-30 returned an HTML page titled Missing Key | Demand around a park. Not NOI | Not loaded. Ask before a Census key |
| BLS CPI | Shelter series is loaded. See the rates table | US city-average shelter index | BLS public v1, no key | Shown on the rate desk. Not used as lot-rent growth | Built |
| FEMA flood hazard | `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer` layer 28 | `FLD_ZONE` at the park point. A Phoenix probe returned X. 2,234 parks now have a zone. A park with no coordinate is left blank | Public ArcGIS | Flood zone on the park page | Built. Nightly fills 100 parks that still have no zone |
| USDA NAIP imagery | National map or USDA geospatial gateway | Aerial tiles | Public imagery | A vision count of occupied pads. Error rate unknown | Deferred and optional. Do not turn on Claude vision until a sample of parks with known site counts is scored by hand |
| Cooper Cardinal rent rolls | A CSV you export from the parks you manage | Actual lot rent, occupancy, expenses | Yours | Replaces the $700 assumption for those parks, and sets a local comp | Deferred until you provide the file. The operating importer can take it. Do not send it to a new vendor |
| OSM, Census TIGER, utility areas | Various | Roads, boundaries, who serves water | Public | Map context | Deferred. Low priority next to price and distress |

## Ownership

| Source | Access | Adds | Verdict |
| --- | --- | --- | --- |
| Owners already on parcels | Query `owners` and the owner page | Parks that share an owner | Built as `/owners/[id]` |
| Held-since | `parcels.last_sale_date`, or `park_operating.owned_since` when entered | Years held, for the owner points and the dossier | Built as a field. Entity transfers still distort it |
| Statutory agent | ACC eCorp | A second address and a dissolved flag | Rejected. robots.txt disallows the site |

## Listing sites and member databases

| Source | Terms read | Verdict |
| --- | --- | --- |
| Crexi | Terms prohibit scraping, automated access, and harvesting (`crexi.com/tos`, section 3.4). robots.txt disallows `/api`, `/comps`, `/property-records`, and most of the app | Rejected |
| CoStar / LoopNet | Named in the project rules as prohibiting scraping. Not re-fetched this session | Rejected |
| MHVillage | Terms prohibit extracting information for commercial use and reproducing the service (`mhvillage.com/terms`) | Rejected |
| Mobile Home Park Store | User agreement prohibits bots, crawlers, scraping, and copying data (`mobilehomeparkstore.com/site/user_agreement`, section IV) | Rejected |
| MHI Community Attributes System, mhicas.org | Terms: license to view only. Content may not be stored in a retrieval system without MHI's written authorization (`mhicas.org/Account/Disclaimer.php`, item 3). Powered by Datacomp | Rejected for any automated or bulk copy, including screenshots parsed into this database |
| MHI monthly economic reports | Member pages. The published PDF footer prohibits republication. Shipments by state, not park-level rent or debt | Rejected for the score. Not a park feed |
| Datacomp / JLT rent surveys | Paid books. January 2026 Phoenix MSA is listed at $465 and covers 106 communities | Rejected as an integration. Candidate for `docs/PAID_UPGRADES.md` if you subscribe and the license allows internal use |

## Courts, water, and the rest of Arizona

Maricopa is the only recorder with a public document API in this file. Pima is a manual export. Yuma, Pinal, Yavapai, Mohave, La Paz, Navajo, Cochise, Coconino, Gila, Graham, Santa Cruz, and Apache have parks on the HIFLD list and no loan feed. Each county's assessor GIS, treasurer, and recorder gets its own row here after a probe. They are not rejected. They are not started. Building twelve counties before Maricopa distress and a measured spread is the wrong order.

## What Beacon uses, and what transferred

Beacon (the South Florida broker CRM) does not have a national park file. A property and its owner come from the county property appraiser, chosen by city:

| Beacon source | Geography | What the roll returns |
| --- | --- | --- |
| Miami-Dade property appraiser (MDPA) | Miami-Dade | Folio, situs, owner name, mailing address |
| Broward BCPA | Broward | Same |
| Palm Beach PBCPA | Palm Beach | Same |
| MassGIS | Massachusetts | Same, one statewide service |

Sunbiz is then used to turn a Florida LLC into officers. CoStar arrives only as a spreadsheet the broker uploads. Listing search uses Brave, Serper, or Jina and is not a system of record. None of those counties, and not Sunbiz, cover an Arizona park.

This desk already follows the same pattern where Arizona publishes it: HIFLD for the park list, the Maricopa and Pima assessors for owner, situs, and last sale, and the Maricopa recorder for the loan. Pinal's mobile-home filter returned no parcels, the statewide AZGEO layer has no owner, and the Arizona Corporation Commission disallows automated collection, so those stay unloaded. Listing sites stay out for the same reason as CoStar.

What did transfer is the desk around that data: a Today page, a sentence that becomes the filters already on Prospects, a copilot that may only speak from those rows, saved views in the browser, and a pipeline balance. The copilot is refused when asked to send mail or to invent a date.

## What shipped from this list

1. SOFR, FRED DGS5/DGS7/DGS10, prime, the Baa spread, the CRE lending survey (`DRTSCLCC`, 6.7 on 2026-07-01), and the BLS shelter CPI (index 432.092 in September 2026) are stored. The survey and the CPI are shown on the rate desk. Neither one changes a loan rate or a lot rent.
2. Maricopa `NS` and `LP` are ingested. Notices that do not match one entity owner of one park stay unlinked.
3. Payment status, NOI, and the modification flag are shown. Defeasance is not parsed.
4. FEMA flood zones are stored for 2,234 parks. A park with no coordinate is left blank. Nightly fills any that are still empty, 100 at a time.
5. EPA's 1,721 active Arizona drinking-water systems are loaded. 31 are attached to a park. A system is attached only when the name still matches after generic words are removed and no second park is close. A one-word overlap is left unlinked. 66 systems are flagged serious violators; 1 of those is attached to a park.
6. Maricopa assessor sale prices that were already on the parcel are shown on the park page, with a price per site when the park has a site count. Pima has no sale-price field.

Census ACS, HUD Fair Market Rents, and CourtListener still need a key you have not asked me to create. The FHA loan workbooks do not. Treasury XML and H.15 are the same numbers as FRED and were not loaded a second time.

Pinal County's public parcel layer (the Casa Grande mirror) answered, and `Assessing_Use_Description LIKE '%Mobile%'` returned no rows. No park use code was identified, so those parcels are not loaded. The Arizona statewide parcel layer at azgeo returns an APN, an address, and a place name, and no owner or use code, so it is not loaded either. The ADWR service named `Parcels_for_TEST` is a test service and was not used. HMDA's aggregation URL returned HTTP 400 for the query that was tried. HMDA is a consumer-mortgage register, not a park-loan tape, and it is not loaded. The Arizona Corporation Commission site disallows automated collection. Rating-agency releases, broker pages, and listing sites stay out. Greystone term sheets stay deferred until a specific URL is cleared.
