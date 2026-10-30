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

## Rates and financing

| Source | URL | Fields | Frequency | Terms decision | Adds | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| FRED DGS5, DGS7, DGS10, DPRIME, BAA10Y | `fredgraph.csv?id=SERIES` | Daily yield, percent. DGS10 on 2026-10-28 was 5.05. 5-year was 4.85 | Daily history in `rate_prints` | Public series, no key. The 2026-10-30 review client 500 on DGS10 did not repeat | Index for the rate desk | Built |
| NY Fed SOFR | `https://markets.newyorkfed.org/api/rates/secured/sofr/search.csv` with `startDate` and `endDate` | Effective date and rate. 3.94% on 2026-10-29. The URL with no dates returns a header and no rows | Each business morning | Public markets API | Floating-rate index | Built |
| Treasury par yield curve | `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=YYYY` | 1-month through 30-year par yields | Daily, ~3:30pm ET | Treasury documents the XML feed as a public GET | Official curve if FRED is down. Duplicate of FRED for 5/7/10 | Deferred. Endpoint is documented. Not fetched this session |
| Fed H.15 | `https://www.federalreserve.gov/datadownload/Choose.aspx?rel=h15` | Constant-maturity Treasuries, prime, weekly and monthly averages | H.15 page showed a release dated 2026-10-29 | Federal Reserve public download | Same numbers as FRED | Deferred as a duplicate. Use only if FRED stays on 500 |
| Fed SLOOS, CRE standards | FRED series such as `DRTSCLCC` via the same CSV URL | Net percent of banks tightening CRE standards | Quarterly | Public FRED | Market-condition badge, not a park rate | Deferred. Series id must be confirmed with a probe. Not assumed |
| Spreads from loans already stored | No new URL. CMBS and SBA note rate minus the 5-year Treasury on the origination date | Median by source and lender type, sample size, as-of. Used in the score when the sample is at least 8. See `docs/ACCURACY.md` | Each `mhdebt rates` | Our own statistic from public filings | Refinance rate with a sample size | Built. Agency rows stay empty until a file is imported |
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
| EPA ECHO / SDWIS | `https://echo.epa.gov/tools/web-services` and `https://echo.epa.gov/files/echodownloads/` (`SDWA_latest_downloads.zip` listed, dated 2026-10-13) | Public water systems, violations | EPA open data. Bulk zip preferred over hammering search | Parks that run their own water and face a capital bill | Deferred. Download the SDWA zip, filter Arizona, match by name and coordinate. Probe the file's columns first |
| ADEQ | azdeq.gov facility search | State violations EPA may lag | Not fetched. Likely a search form | Same capital-need signal | Deferred, unverified. Reject if the terms or robots forbid automation |
| CMBS fields already parsed | EX-102 via the existing job | `payment_status` and NOI show on the loan row. `modified` shows when it is in `raw`. Defeasance is not parsed: no fixture has shown the tag | Already permitted | A CMBS loan in special servicing is visible. Prepayment lockout is not | Built for the fields already stored. Defeasance still waits on a fixture |
| Code enforcement | Phoenix and Tucson open data | Cases by address | Not reviewed this session | Habitability problems that force a sale or a capex line | Deferred, unverified |

## Value, upside, and fit

| Source | URL | Fields | Terms decision | Adds | Verdict |
| --- | --- | --- | --- | --- | --- |
| Park sale comps from recorded deeds | Maricopa and Pima deed documents we can already request by number, plus assessor `last_sale_date` and sale price if the parcel layer has it | Price, date, buyer, seller. Price per site after the site count is known | Same APIs as the parcel and recorder jobs. Confirm the assessor sale-price field with a probe before using it | The only free price evidence | Deferred. The current parcel mapper stores last sale date, not a cleaned price-per-site series |
| HUD Fair Market Rents | `https://www.huduser.gov/hudapi/public/fmr` | FMR by county and bedroom | Public, but the documented API uses a bearer token | A ceiling on what a park-owned home might rent for. Not lot rent | Deferred. Ask before registering for the token |
| Census ACS | `https://api.census.gov/data` | Income, rent burden, population | Free. A key raises the rate limit; keyless is limited | Demand around a park. Not NOI | Deferred. Ask before a Census key. Keyless probe first |
| BLS CPI | `https://download.bls.gov/pub/time.series/cu/` or the public API | Shelter CPI | BLS public, registration for the v2 API | Default lot-rent growth in a 5-year IRR, labeled as CPI not as park rent | Deferred. Public files. Probe the series id |
| FEMA flood hazard | `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer` layer 28 | `FLD_ZONE` at the park point. A Phoenix probe returned X. 25 parks were written on 2026-10-30 | Public ArcGIS | Flood zone on the park page, blank until filled | Built. Nightly fills 100 parks that have no zone |
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

## What shipped from this list

1. SOFR, FRED DGS5/DGS7/DGS10, prime, and the Baa spread are stored. The Rate Desk shows them with the measured CMBS and SBA spreads.
2. Maricopa `NS` and `LP` are ingested. Notices that do not match one entity owner of one park stay unlinked.
3. Payment status, NOI, and the modification flag are shown. Defeasance is not parsed.
4. FEMA flood zones are filling, 100 parks a night.
5. The EPA drinking-water zip is still not loaded. Its columns have not been confirmed.

No new API key, no paid source, and no login.
