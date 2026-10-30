# Free Data Source Catalog: Park Debt and Acquisition Intelligence

Researched October 30, 2026. This catalog lists the free, public sources behind what Trepp, TreppWire, CRED iQ, MSCI Real Capital Analytics, Reonomy, Cherre, ATTOM and Datacomp sell, plus related sources that matter for buying mobile home parks and RV parks.

**Verification column (Ver.):**
- **V** = checked on the source's own page during research
- **P** = page exists, but the field details come from general knowledge
- **U** = not verified; confirm it with a probe before building

**Priority column (Pri.):**
- **1** = build first
- **2** = build next
- **3** = useful later or for context
- **✗** = don't automate (terms, cost or no value)

## Facts that shape the build

1. **Free loan-level data on parks exists in four places:**
   - CMBS asset data (property type `MH`)
   - HUD/FHA insured mortgages (Section of Act code)
   - Fannie Mae DUS Disclose (Specific Property Type)
   - County recorder and assessor records

   RV parks have no federal property code. Find them in CMBS by name (`MH`, `OT` or `LO` plus park words) and in SBA data by NAICS 721211.
2. **Most CMBS problem-loan detail is free** in the trustee statement (EX-99.1) filed with each monthly 10-D: delinquent, specially serviced, modified and liquidated loans. The full servicer files, including watchlists and comments, go only to bondholders. Don't certify as an investor to get them.
3. **SASB and CRE CLO deals mostly don't file on EDGAR** (they're Rule 144A deals). Rating agency press releases are the only free view. Example: JPMCC 2021-MHC, 93 parks, $478.5M.
4. **The Fed discontinued its business-lending rate survey (E.2) in 2017.** No free Fed series gives current CRE loan rates. Build today's rate as an index (Treasury or SOFR) plus a spread, and measure the spread from recent agency and CMBS park loans and published lender pricing sheets.
5. **CME Term SOFR needs a license** to use in a product. Use NY Fed SOFR and its averages instead.
6. **Licensing:**
   - SEC, HUD, SBA, HMDA, Census, BLS and FRED Fed data are public and usable.
   - **Fannie Mae's Multifamily Loan Performance Data prohibits commercial use without written consent.**
   - DUS Disclose, Freddie MSIA and all rating agency content are under their own terms. Use them internally until those terms are confirmed.
7. **Do not scrape:**
   - LoopNet, BizBuySell, LandWatch, Ten-X (all CoStar-owned, active litigation)
   - Crexi (anti-automation terms)
   - MHVillage (terms bar commercial extraction)
   - Zillow and Redfin sites (use their published datasets instead)
   - MobileHomeParkStore, RVParkStore and MHBay terms are unconfirmed; assume no until checked, and use their email alerts.
8. **Arizona is a sale-price disclosure state.** The Affidavit of Property Value records the price with each deed. Non-disclosure states, where prices aren't public: AK, ID, KS, LA, MS, MO (some counties), MT, NM, ND, TX, UT, WY.
9. **HIFLD Open shut down on Aug 26, 2025.** Its park layer survives in archives.
10. **Other changes since the earlier plan:**
    - Google Open Buildings has no US coverage.
    - EPA removed EJScreen in Feb 2025.
    - Arizona's ACC eCorp was replaced by the Arizona Business Center on Jan 12, 2026, with no bulk data.
    - CourtListener's API is limited to 125 requests a day.

---

## A. Loans and debt

### A1. CMBS on SEC EDGAR (the free Trepp/CRED iQ core)

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| 10-D EX-102 asset data | sec.gov (ABS-EE) | Every loan: originator, balance, rate, maturity, IO/balloon, payment status, modified flag, servicer. Every property: name, address, type, units, value, occupancy, NOI, DSCR, defeasance and lockout dates | EDGAR XML; 10 requests/sec with User-Agent; public | V | **1 (built)** |
| 10-D EX-99.1 trustee statement | sec.gov | Delinquency, specially serviced, modified and liquidated loan detail, plus losses | HTML/PDF exhibit; public | P | **1** |
| 424B2/424H prospectus Annex A, FWP | sec.gov | Loan tape at issuance: sponsor/borrower name, LTV, DSCR, reserves, loan summaries | HTML/PDF/Excel; public | P | **1** |
| EDGAR full-text search API | efts.sec.gov/LATEST/search-index | Keyword search across all filings since 2001 (park names, owner names, "manufactured housing community") | JSON; 10k-result cap per query | V | **1** |
| edgartools (Python) | edgartools.readthedocs.io | Parses CMBS 10-Ds into loans and properties tables | Open source | V | **1** |
| 8-K (CMBS trusts) | sec.gov | Pooling and servicing agreements, special servicer replacements | Public | P | 3 |
| ABS-15G, 10-K EX-33/34/35 | sec.gov | Repurchase demands, servicer compliance | Public | P | 3 |
| data.sec.gov submissions/XBRL APIs | data.sec.gov | Filing lists for each filer, XBRL facts | JSON; public | P | 2 |

### A2. Agency and government-insured loans

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| Fannie Mae DUS Disclose | capitalmarkets.fanniemae.com | Property name and address, Specific Property Type (MHC), balance, maturity, rate, DSCR, servicer | Free registration; check terms | V | **1 (loader built)** |
| Freddie Mac MSIA | mf.freddiemac.com/investors/data | Monthly loan and property reporting for K and SB deals | Free login; terms | V | **1 (loader built)** |
| Freddie K/SB offering circulars | mf.freddiemac.com | Loan tapes at issuance with property names | PDF/Excel; free | P | 2 |
| HUD Insured Multifamily Mortgages | catalog.data.gov/dataset/insured-multifamily-mortgages-database | Project name and address, units, rate, maturity, balance, holding and servicing lender, Section of Act code (Section 207 = parks) | Excel; public; monthly | V (MH codes U) | **1** |
| HUD Terminated Multifamily Mortgages | catalog.data.gov | Payoff and claim history | Excel; public | P | 2 |
| Ginnie Mae multifamily disclosures | bulk.ginniemae.gov | FHA pool and loan data; joins to HUD by project number | Bulk files; some need registration | P | 2 |
| Fannie Mae MF Loan Performance Data | capitalmarkets.fanniemae.com | 73k loans, 62 fields | **Commercial use prohibited** | V | ✗ (internal research only) |
| Freddie MF Loan Performance Database | mf.freddiemac.com | 35 fields since 1994; no property type | Free; terms | V | 3 |
| FHFA Duty to Serve reports | fhfa.gov/duty-serve-program | Agency MHC lending counts and goals | PDF | V | 3 |
| FHFA Public Use Database | fhfa.gov/data/pudb | Agency multifamily, no property type | CSV | V | ✗ |

### A3. Government small-business and rural loans

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| SBA 7(a)/504 FOIA | data.sba.gov/dataset/7a-504-foia | Named borrowers, lender, amount, rate, term, NAICS (721211 RV parks), status, charge-offs | CSV; public; quarterly | V | **1 (loader built)** |
| USDA RD Lender Lens / B&I loans | rd.usda.gov (lender list and performance data) | Guaranteed loan portfolio, delinquency, lenders | Dashboards; free | V | 3 |
| CDFI Fund CIIS/TLR | cdfifund.gov | CDFI loans, no borrower names (resident-owned community conversions) | Excel; 2–3 yr lag | P | 3 |

### A4. Banks, credit unions and lending conditions

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| FDIC BankFind API | api.fdic.gov/banks | Each bank's CRE, multifamily and nonfarm nonresidential loans, past due, charge-offs | JSON, no key | P | **1 (built)** |
| FFIEC CDR call reports / UBPR | cdr.ffiec.gov | Full call reports in bulk | Bulk; free | P | 2 |
| NCUA 5300 call reports | ncua.gov | Credit union commercial loans, delinquency | Bulk ZIP | V | 3 |
| HMDA | ffiec.cfpb.gov | Loans on park land are reportable: lender LEI, amount, rate, term, tract (filter business purpose, 5+ units) | API/CSV; public; annual | V (park coding U) | 2 |
| Fed Senior Loan Officer Survey | federalreserve.gov/data/sloos | CRE and multifamily lending standards | CSV/PDF; quarterly | V | 2 |
| Fed Z.1, H.8 | federalreserve.gov | CRE debt by holder; weekly bank CRE balances | CSV | V/P | 3 |
| MBA delinquency and maturity releases | mba.org | Delinquency by lender type; annual maturity volumes | PDF; free summaries | V | 3 |

### A5. Rating agencies and free industry research

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| Morningstar DBRS press releases + Viewpoint | dbrs.morningstar.com; viewpoint.dbrsmorningstar.com | Rating actions naming loans, with servicer commentary; covers SASB/CRE CLO park loans | Free registration; copyrighted | V | **1** (read, summarize, link) |
| Fitch, Moody's, S&P press releases | each site | Rating actions and rationales | Free registration (U) | U | 2 |
| KBRA | kbra.com | Press releases free; **surveillance and presale reports need paid CMBS Premium** | Paid for reports | V | 3 |
| Trepp TreppTalk / monthly delinquency report | trepp.com | Delinquency and special servicing by property type | Free articles; TreppWire is paid | P | 3 |
| CRED iQ blog / distress rate | cred-iq.com/blog | Distress rates, loan case studies | Free | P | 3 |
| CREFC IRP specs | crefc.org | Field definitions for parsing trustee statements | Mostly members-only | U | 3 |

### A6. Public REITs and private capital

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| Equity LifeStyle (ELS) filings | EDGAR CIK 895417 | Debt totals, weighted average rate (3.77%), maturities, Arizona revenue share | EDGAR/XBRL; public | V | 2 |
| Sun Communities (SUI) filings | EDGAR CIK 912593 | Schedule III by property; debt at 3.3% average; acquisitions and sales with prices | EDGAR; public | V/P | **1** (comps) / 2 (debt) |
| UMH Properties filings | EDGAR CIK 752642 | Mortgage schedule (lender, rate, maturity), properties | EDGAR; public | P | 2 |
| Manufactured Housing Properties Inc. | EDGAR CIK 1277998 | Small MHC owner's debt and deals | EDGAR; public | V | 3 |
| Flagship Communities REIT | sedarplus.ca | Midwest MHC acquisitions with prices | PDF; public | P | 3 |
| SEC Financial Statement and Notes data | sec.gov/dera/data | Schedule III and debt-maturity XBRL across all filers | Quarterly ZIP | P | 3 |
| Form D data sets | sec.gov/dera/data/form-d | Park syndicators and funds raising money (issuer, people, amounts, dates) | Quarterly ZIP; public | V | **1** (owner and recap signals) |
| Reg A / Reg CF data sets | sec.gov/dera/data | Smaller offerings, some with property and debt lists | Quarterly ZIP | V | 3 |

---

## B. Parks, property and ownership

### B1. The park universe

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| HIFLD Mobile Home Parks (DataLumos archive) | datalumos.org/datalumos/project/239601 | National park points: name, address, type, status, units, size | GeoJSON/SHP; free; frozen Sep 2024 | V | **1 (built)** |
| HIFLD NASA NCCS mirror | maps.nccs.nasa.gov/…/hifld_open/public_venues/MapServer/3 | Same data, queryable | ArcGIS REST | V | **1 (built)** |
| HIFLD Data Rescue / source.coop | portal.datarescueproject.org; source.coop/seerai/hifld | Parquet backups | Bulk | V | 3 |
| OpenStreetMap (Overpass) | overpass-api.de | Park **boundaries**: `residential=trailer_park`, `tourism=caravan_site`, `tourism=camp_site` | Free; ODbL share-alike | V/U | **1** |
| Overture Maps places and buildings | overturemaps.org | Campground/RV categories, merged building footprints | GeoParquet; free | U | 2 |
| Microsoft US Building Footprints | github.com/microsoft/USBuildingFootprints | Building polygons. Footprints inside a park boundary ≈ home count; vs. site count ≈ vacancy | Bulk; ODbL | V | **1** |
| USDA NAIP aerial imagery | Planetary Computer / AWS | 0.6 m imagery every ~2 years: empty pads, deferred maintenance | COG; free | U | 2 |
| Recreation.gov RIDB API | ridb.recreation.gov | Federal campgrounds (RV competition) | API key; free | U/V | 3 |
| Census ACS B25024 | api.census.gov | Mobile-home share by tract; finds unlisted parks | API; free | U | 2 |

### B2. State park registries

| State | Link | What it gives | Access | Ver. | Pri. |
|---|---|---|---|---|---|
| Florida DOH MH/RV parks | aquarius.at.geoplan.ufl.edu/…/SCE_Points/MapServer/0 | ~5,500 parks: permits, inspections, **owner name and mailing address**, phone | ArcGIS REST | V | 2 (national) |
| Colorado DOLA MHPOP | doh.colorado.gov/mobile-home-parks | Registry, lot counts, **"Parks for Sale" sheet**, rent-restricted parks list | Web + Google Sheets | V | 2 |
| New York DHCR | data.ny.gov/d/nq2i-9jge | Parks, capacity, occupied sites, **owner** | Socrata API | V | 2 |
| Oregon OHCS | oregon.gov/ohcs/mmcrc | Directory, vacancies, closures | Web/PDF | V | 2 |
| Illinois IDPH | data.illinois.gov | Licensed communities (stale, 2019) | XLSX | V | 3 |
| Maine MHC dashboard | arcg.is/1nezGL1 | 475 parks, vacant lots, average lot rent by county | ArcGIS | V | 3 |
| Vermont MHP Registry | outside.vermont.gov (annual PDF) | Lot rent for each park, vacancies, ownership | PDF | V | 3 |
| Washington, California, Michigan, Texas | state agencies | Registries exist; no public download found | Public records request | V/U | 3 |
| Arizona | — | No public park registry. Use parcels + HIFLD + OSM (see B3) | — | V | — |

### B3. Arizona parcels and assessors

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| **ADWR statewide parcels (all 15 counties)** | azwatermaps.azwater.gov/arcgis/rest/services/General/Parcels/MapServer (layers 0–14) | APN, site address, owner name, acres, geometry, one schema statewide | ArcGIS REST; free; ~Nov 2023 snapshot | V | **1** |
| Maricopa Assessor API | mcassessor.maricopa.gov (token by request) | Parcel, owner, valuation, **rental registrations**, **MH personal-property accounts** (homes per park) | REST; free token | V | **1** |
| Maricopa Assessor GIS | gis.mcassessor.maricopa.gov/…/Parcels/MapServer/0 | PUC use codes, owner, mailing, deed number, sale date and price | ArcGIS REST; free | V | **1 (built)** |
| Maricopa bulk affidavit sales | mcassessor.maricopa.gov/page/data_sales | Bulk sale affidavits: **$400 commercial** / $100 non-commercial | Paid | V | ✗ (use parcel layer) |
| Pima GIS Open Data | gisdata.pima.gov/…/LandRecords/MapServer/12 | PARCEL_USE code, mailing, record date, values | ArcGIS REST; free | V | **1 (built)** |
| Tucson PRO parcel search | pro.tucsonaz.gov/parcel_search/{APN} | Zoning, **code-enforcement cases**, nonconforming-use letters | Web; scrape gently, check terms | V | 2 |
| Pinal parcels | gismaps.pinalcountyaz.gov/…/Parcels_Webservice/FeatureServer | Parcels with CAMA and tax fields | ArcGIS REST | V | **1** |
| Yuma County GIS | arcgis.yumacountyaz.gov/webgis/rest/services | Parcels, ownership, **tax deed parcels** | ArcGIS REST | V | **1** |
| Coconino EagleWeb | eagleassessor.coconino.az.gov | Parcel, value, tax status | Web | V | 2 |
| Mohave, Yavapai, Cochise, Navajo, Apache, Gila, Graham, Greenlee, La Paz, Santa Cruz | county assessor sites | Parcel search; geometry from the ADWR layer | Web | U | 2 |
| ADOR Manufactured Housing Manual | azdor.gov (PDF) | Park spaces leased 30+ days = Class 4; ≤29 days = Class 1 (separates MH from RV). Operators file **Form 82505 monthly** with the assessor | Reference | V | **1** (classification) |
| Monthly park reports (Form 82505) | assessor, e.g. mohave.gov park report instructions | Per space: arrivals and departures, home owner, VIN, **vacant spaces** | Public records request | V | 2 (real occupancy) |
| Regrid, Land Records | regrid.com; landrecords.us | Parcel aggregators | Paid for API/bulk | V/U | ✗ |

**Finding park parcels in Arizona use codes:** spatially join HIFLD and OSM park points to parcels, count the use codes those parcels carry, and confirm against ADOR legal class (4 vs 1). Maricopa's 0840–0899 range is already in the code. Confirm every other county the same way.

### B4. Recorders, deeds and sale prices

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| Maricopa Recorder | recorder.maricopa.gov | Deeds, deeds of trust, releases, assignments, modifications, trustee sale notices, lis pendens, liens | Web search + public API (built; endpoints to confirm by probe) | V | **1 (built)** |
| Pima Recorder | recorder.pima.gov/PublicSearch | Index and images | Web; export → loader (built) | V | **1** |
| Pinal Recorder (Acclaim) | acclaim.pinalcountyaz.gov/acclaimweb | Index; free name-match notifications | Web | V | **1** |
| Mohave Recorder (Eagle) | eaglerss.mohave.gov/web | Grantor/grantee index since 1988 | Web, disclaimer gate | V | 2 |
| Gila Recorder (EagleWeb) | recorder.gilacountyaz.gov | Index | Web | V | 2 |
| Other AZ recorders | county sites; thecountyrecorder.com | Index; free match notifications | Web | U | 2 |
| AZ Affidavit of Property Value | azdor.gov | Sale price, date, personal property included, financing type | Flows into assessor sale fields | V/U | **1** |

**Recorded documents that matter, in order:**
1. Notice of trustee's sale (Arizona forecloses in about 90 days, outside court)
2. Lis pendens
3. Deed of trust (loan age, lender)
4. Release (payoff timing)
5. Modification or extension
6. Mechanics', IRS and state tax liens
7. Assignment of deed of trust (often a loan sale or securitization)

### B5. Taxes

| Source | Link | What it gives | Access | Ver. | Pri. |
|---|---|---|---|---|---|
| Pinal Treasurer tax lien sale | treasurer.pinal.gov/ParcelInquiry/Main/TaxLienSale | **Downloadable delinquent lien list** | Generated report; free | V | **1** |
| Maricopa Treasurer | treasurer.maricopa.gov/TaxLienWeb; maricopa.arizonataxsale.com | Delinquency map; parcel lists | Web / free bidder registration | V | **1** |
| Pima Treasurer | to.pima.gov/taxLienSale | Lien sale lists | Web / registration | V | **1** |
| Mohave Treasurer | mohave.gov (tax lien sale) | Lien sale | Web | V | 2 |
| Yuma tax deed parcels | Yuma GIS layer | Parcels headed to tax deed | ArcGIS REST | V | **1** |
| Other AZ treasurers | county sites; newspaper legal notices | Delinquency | Web | U | 2 |

### B6. Courts

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| CourtListener / RECAP | courtlistener.com | Federal and bankruptcy dockets; alerts by email or webhook | API: **5/min, 50/hr, 125/day**, one account | V | **1** (alerts on owner entities) |
| PACER | pacer.uscourts.gov | Full dockets and claims | $0.10/page, fees waived under $30/quarter | P | 2 |
| AZ Judicial Branch Public Access | apps.azcourts.gov/publicaccess | Civil, eviction and justice-court cases (eviction spikes, receiverships) | Web with **CAPTCHA**, so no automation. Paid bulk subscription available | V | 2 (manual) / paid bulk |
| Maricopa Superior Court | superiorcourt.maricopa.gov | Civil dockets, receiverships | Web | U | 2 |

### B7. Owner entities

| Source | Link | What it gives | Access | Ver. | Pri. |
|---|---|---|---|---|---|
| Arizona Business Center (ACC) | arizonabusinesscenter.azcc.gov | Statutory agent, members/managers, status | Lookup only; no bulk | V | 2 (on-demand lookup) |
| ACC eDocket | edocket.azcc.gov | Rate cases and transfers for private water companies serving parks | Web | U | 2 |
| Florida Sunbiz bulk | dos.fl.gov/sunbiz/other-services/data-downloads | All FL entities, daily | Bulk; free | V | 2 (national) |
| Colorado entity data | coloradosos.gov (Socrata) | All CO entities and agents | API; free | V | 2 (national) |
| OpenCorporates | opencorporates.com | Multi-state entities | Paid API (~£2,250/yr) | V | ✗ |
| IRS EO Business Master File | irs.gov | Nonprofit and resident-owned community owners | Bulk; free | U | 3 |
| UCC filings (AZ, TX, FL) | azsos.gov; direct.sos.state.tx.us; floridaucc.com | Liens on home inventory and equipment | AZ bulk paid; TX $1,150+; FL search free | V/U | 3 |

### B8. Operations, environment and regulation

| Source | Link | What it gives | Access | Ver. | Pri. |
|---|---|---|---|---|---|
| EPA ECHO SDWA bulk download | echo.epa.gov | Water systems, service-area type (mobile home park code to confirm), **violations and enforcement** | Bulk CSV; quarterly | V | **1** |
| ADHS/ADWR community water system areas | services1.arcgis.com/…/Public_Water_System_from_Arizona_EPHT_Explorer/FeatureServer/1 | Water service polygons with system and owner names | ArcGIS REST | V | **1** (matches systems to parks) |
| ADEQ data | azdeq.gov; waterdata.azdeq.gov | Compliance, aquifer permits, septic | Web | U | 2 |
| EPA NPDES (via ECHO) | echo.epa.gov | Wastewater permits and violations | Bulk/API | U | 2 |
| FEMA National Flood Hazard Layer | hazards.fema.gov/arcgis/rest/services | Flood zones | ArcGIS REST | U | 2 |
| AZ change-of-use notices | housing.az.gov | Owner must notify the Director **180 days** before closing or converting a park (A.R.S. 33-1476.01) | Public records request | V | **1** (request regularly) |
| City code enforcement (Phoenix, Mesa, Tucson) | phoenixopendata.com; data.mesaaz.gov; Tucson PRO | Code cases at park addresses | Socrata/web | U/V | 2 |
| Rezoning and planning agendas | Legistar/AgendaCenter sites | Rezoning on park parcels (redevelopment exits) | Scrape/RSS, check terms | U | 2 |
| Maricopa ESD RV park permits | maricopa.gov | RV park permits and inspections | Records request | V | 3 |
| EJScreen mirrors | screening-tools.com | Archived environmental indicators | Bulk; frozen | V | ✗ |

---

## C. Rates and financing conditions

| Source | Link | What it gives | Access and terms | Ver. | Pri. |
|---|---|---|---|---|---|
| FRED API | api.stlouisfed.org/fred | DGS1MO–DGS30 (DGS5, DGS7, DGS10 key), DFII5/10, T10Y2Y, SOFR, SOFR30/90/180DAYAVG, SOFRINDEX, DFF, DPRIME, AAA, BAA, BAA10Y, BAMLC0A0CM, BAMLH0A0HYM2, MORTGAGE30US/15US, SUBLPDRCSC and other SLOOS series, DRCRELEXFACBS | REST; free key; some ICE series need attribution and have shorter history | V | **1** |
| US Treasury daily par yield curve | home.treasury.gov (daily_treasury_yield_curve XML/CSV) | Same-day curve, 1-mo to 30-yr, since 1990 | XML/CSV; public | V | **1** |
| NY Fed Markets API | markets.newyorkfed.org/api/rates/… | SOFR, SOFR averages and index, EFFR, OBFR | JSON, no key; attribution | K | **1** |
| Fed H.15 / Data Download Program | federalreserve.gov/releases/h15 | Official rates, SLOOS tables | CSV/XML | V | 2 |
| **Measured park-loan spreads** (derived) | EX-102, DUS Disclose, HUD, new CMBS issues | Note rate minus matching Treasury at origination, by lender type, term and date | Built from A1/A2 data | — | **1** |
| Greystone "Today's Pricing" sheets | greystone.com/wp-content/uploads/… (dated PDFs) | Small-balance spreads and all-in rates by term and leverage (apartments; add an MH premium) | PDF; reuse terms U | V | **1** |
| Agency MHC term sheets | multifamily.fanniemae.com; arbor.com; greystone.com | Max LTV, min DSCR, amortization, terms | PDF; free | V | **1** (sizing rules) |
| PeerSense rate tracker | peersense.com (multifamily rates; CMBS manufactured housing page) | Rate ranges by loan type, including an MH CMBS range | HTML; terms U | V | 2 |
| Janover multifamily.loans | multifamily.loans/multifamily-mortgage-rates | Agency, CMBS and bank rate ranges | HTML; © ask before republishing | V | 2 (reference) |
| Chatham Financial | chathamfinancial.com/technology/us-forward-curves | SOFR and Treasury forward curves, swaps | Web/Excel; reuse terms U | K | 2 (forward refi projections, after permission) |
| Freddie Mac PMMS | freddiemac.com/pmms | 30/15-yr mortgage rates | CSV/FRED | V | 3 |
| KC Fed Small Business Lending Survey | kansascityfed.org | Small-business loan rates and standards (successor to E.2) | PDF; quarterly | V | 3 |
| CME Term SOFR | cmegroup.com | Term SOFR | **License required** | V | ✗ |

---

## D. Market fundamentals, comps and news

### D1. Demand, income and affordability

| Source | Link | What it gives | Access | Ver. | Pri. |
|---|---|---|---|---|---|
| Census ACS API | api.census.gov | B25024, B25032/33, B25064, B19013, B01003, B25004 by tract or county | API; free key | V/K | **1** |
| **ACS PUMS variable MHP** | api.census.gov (PUMS MHP) | Annual mobile home costs including **site rent and fees** for owner-occupied homes: the only free lot-rent proxy, by PUMA | API; free | V | **1** |
| American Housing Survey | census.gov/programs-surveys/ahs | In-park vs scattered homes, park fees | Table Creator/PUF | V | 2 |
| Census Manufactured Housing Survey + PUF | census.gov/programs-surveys/mhs | New home placements and prices by region | CSV/FRED | V | 2 |
| MHI Economic Report | manufacturedhousing.org (monthly PDF) | Shipments by state | PDF; predictable URL | V | 2 |
| Census Population Estimates | api.census.gov (pep) | County and place growth | API | V | **1** |
| Census County Business Patterns | api.census.gov (cbp) | RV park/campground establishments (NAICS 721211) by county | API | V | 2 |
| Census Building Permits | census.gov/construction/bps | New housing supply | TXT/CSV | V | 3 |
| IRS SOI migration | irs.gov | County-to-county moves and income (retiree inflow) | CSV | V | 2 |
| HUD Fair Market Rents / Small Area FMR API | huduser.gov/hudapi/public/fmr | Rent ceilings by county and ZIP (lot rent + home payment vs FMR = headroom) | API; free token | K | **1** |
| HUD Income Limits API | huduser.gov/hudapi/public/il | Area median income | API | K | 3 |
| HUD USPS vacancy | huduser.gov | Tract vacancy | CSV; registration limits | K | 3 |
| BLS API v2 | api.bls.gov | CPI (lot rent escalation), QCEW, county unemployment | API; free key | K | **1** |
| BEA Regional API | apps.bea.gov/api | County income | API; free key | K | 3 |
| FHFA HPI | fhfa.gov/data/hpi | House price index (MH price gap vs site-built homes) | CSV | V | 3 |
| Zillow Research data / Redfin Data Center | zillow.com/research/data; redfin.com/news/data-center | Rents and home values (attribution required). Use the datasets, not the sites | CSV/TSV | V | 3 |
| Arizona OEO / laborstats.az.gov | oeo.az.gov | AZ jobs, population projections | XLS/PDF | V | 2 |
| AZ Dept of Housing MH program | housing.az.gov | MH Landlord-Tenant Act; closure and rent-increase relocation rules (no rent control; no rent filings) | PDF | V | **1** (rules) |
| ARS 33-1401 et seq. | azleg.gov | 90-day rent-increase notice, relocation fund, change-of-use rules | HTML | V | **1** (rules) |
| KOA camping report, OHI, RVIA shipments, NPS visitation | koa.com; ohi.org; rvia.org; irma.nps.gov | RV demand indicators | PDF/CSV | V/K | 3 |

### D2. Comps and lot rents

| Source | Link | What it gives | Access | Ver. | Pri. |
|---|---|---|---|---|---|
| Arizona sale prices (assessor + affidavit) | see B3/B4 | Price per site for every recorded park sale | Parcel layers | V | **1** |
| REIT acquisitions and dispositions | EDGAR (ELS, SUI, UMH 10-Q/10-K/8-K) | Deal prices and site counts (e.g. SUI: two Pacific NW MH properties for $79.5M) | XBRL/HTML | V | **1** |
| REIT rent disclosures | ELS/SUI 10-K | Average monthly MH rent by state, Arizona included | HTML | K | **1** (lot rent benchmark) |
| Northmarq MHC research + transactions | northmarq.com/insights; /transactions | Median price per space ($62K, Q2 2026), cap rates (~6.5%), rent growth; closed AZ deals (e.g. Country Club Village, Mesa, $44M) | HTML/PDF | V | **1** |
| Marcus & Millichap MH report + press | marcusmillichap.com/research | Cap rates (~7%), rent growth, closed deals | PDF; registration | V | **1** |
| Berkadia, JLL, Newmark, Colliers, Walker & Dunlop, Matthews | firm research pages | MHC capital markets notes, deal releases | PDF/HTML | U/V | 2 |
| CBRE Cap Rate Survey | cbre.com | Phoenix multifamily cap rates (no MHC) for spread context | PDF; registration | V | 3 |
| Trade press RSS: REBusiness, GlobeSt, ConnectCRE, Bisnow, CRE Daily, Commercial Observer, Multi-Housing News, MHInsider | each site's /feed | Deal announcements: park, price, sites, buyer, broker, lender | RSS (confirm each); don't republish full text | U | **1** |
| Lender financing press releases | Greystone, Arbor, Lument, Walker & Dunlop, NewPoint | Park loans: name, city, amount, program, borrower (fills bridge and debt-fund gaps) | RSS/HTML; check terms | U | **1** |
| Google News RSS | news.google.com/rss/search?q=… | Discovery feed for park deals and distress | Unofficial RSS; light polling, link out | V | **1** |
| MSCI RCA CPPI / Green Street CPPI | headlines only | Price index trend | Press | V | 3 |
| Datacomp | — | Lot rent data. Note: a 2023 class action alleges operators used Datacomp data to inflate rents | — | V | ✗ |

### D3. Listings (manual only)

| Source | Status |
|---|---|
| MobileHomeParkStore, RVParkStore, MHBay | Terms unconfirmed: subscribe to email alerts and forward them to an inbox the app parses, or ask for a feed |
| Crexi | No read API, anti-automation terms: email alerts only |
| LoopNet, BizBuySell, LandWatch, Ten-X | CoStar terms prohibit scraping: manual only |
| MHVillage | Commercial extraction prohibited: manual only |

---

## Not replicable for free
- Broker-reported deals that never hit public records (e.g. sales done by transferring the LLC that owns the park).
- Full CMBS servicer files, watchlists and special-servicer comments (bondholders only).
- SASB/CRE CLO loan-level files (Rule 144A).
- Borrower operating statements on non-CMBS loans.
- Datacomp-style surveyed lot rents for every park.
