# Coverage after the public-source pass (2026-10-30)

This is what the desk now loads, and what was looked at and left out. Counts are from the load on 2026-10-30. A later `mhdebt run` refreshes them. A park with a blank phone, website, or other nullable park field is stored with that field empty. The blank does not drop the park or stop the rest of the file. The park name is required. A later tape from the same source refreshes the balance it wrote. A quoted document can fill a blank origination date or lender, and it does not replace one already stored. Saving a custom field, or a lot rent accepted from a quoted document, needs `supabase/migrations/20261112000014_save_field_and_quoted_rent.sql` applied on the live project before that save sticks.

## Loaded

- **FHA mobile-home mortgages.** HUD's active and terminated workbooks. A row is kept only when the section-of-act category contains "mobile home." That matched `207 MOBILE HOME COURTS` and `223d 2yr Opr. Loss/207 Mobile Home Park`. The active file had 2 loans, in California and Washington. The terminated file had 135. None were in Arizona. Names that merely contain "mobile" or "manufacturers" are not loaded. These loans use source `hud` and do not change a score unless one is later tied to a park.
- **Form D.** The latest quarterly zip linked from the SEC data-sets page. 2026 Q3 had 10 issuers whose names say MHC, mobile home, manufactured housing, or RV park. The amount sold is stored when the file gives a number. "Indefinite" stays blank. This is a securities offering, not a loan maturity.
- **EDGAR search.** One page (40 hits) for each of two fixed queries: "mobile home park" on 10-K, 10-Q, and 8-K, and "manufactured housing community" on ABS-EE, 424B, FWP, and 8-K. Each row is a link to the filing index. The filing text is not copied. The same "mobile home park" phrase on ABS-EE alone returned no hits.
- **EX-99 links.** Eight ABS-EE filing indexes a night, plus twelve 8-K indexes from the search hits on the first pass. When the index names an EX-99 file, the URL is stored and the file is not downloaded. Embedded images are skipped. The first eight ABS-EE indexes in the current quarter named EX-102 and EX-103, the loan tape the CMBS job already reads, and did not name an EX-99. The first twelve 8-Ks produced 25 document links, including FG Communities and two CMBS trusts.
- **Headlines.** Up to 15 items from the Google News RSS query `Arizona "mobile home park"`. The article page is not fetched.
- **Arizona unemployment.** BLS series `LASST040000000000003`. September 2026 was 4.9 and marked preliminary. It is shown on the rate desk. It is not a park rate and it is not in the score.
- **Distress, sales, and recorded owners**, rebuilt from rows already stored. Distress is a trustee-sale notice, lis pendens, or trustee deed: 40 events, none tied to a single park. Sales are the 572 Maricopa assessor prices already on parcels. Pima's layer has no price. Recorded owners are 1,305 names on the assessor roll, linked to 1,459 park parcels. That is not a finding about who benefits from the ownership.

The Signals page shows these tables. Demo mode has a fictional row in each one.

## Looked at and not loaded

- **Pinal parcels.** The Casa Grande mirror answered. `Assessing_Use_Description LIKE '%Mobile%'` returned no rows. No park use code was identified, so nothing was ingested.
- **Arizona statewide parcels (AZGEO).** One feature returned `AZ_APN`, `AZ_Address`, and `AZ_PlaceName`. No owner and no use code.
- **ADWR `Parcels_for_TEST`.** The service name says it is a test layer. It was not used.
- **HMDA.** A guessed aggregations URL returned HTTP 400. HMDA is a consumer-mortgage register, not a national park-loan tape.
- **Census ACS, HUD Fair Market Rents, CourtListener, and the Maricopa assessor token.** Each needs an account. None was created.
- **Arizona Corporation Commission.** The site's robots file disallows automated collection.
- **Fannie Mae and Freddie Mac loan files.** The importers exist. The commercial-use terms on the Fannie file are not cleared, and there is no MSIA login. Zero agency rows.
- **Greystone and agency term-sheet PDFs.** Not fetched. A specific URL has to be cleared first.
- **Rating-agency releases, broker listings, CoStar, LoopNet, Crexi, MHVillage, and Zillow or Redfin pages.** Not collected. A Zillow or Redfin figure would have to come from a dataset those companies publish for reuse.
- **Code enforcement, treasurer lien rolls, city agendas, and Microsoft building footprints.** No verified bulk feed in this pass.

## Still yours to do

The Actions secrets `DATABASE_URL` and `ANTHROPIC_API_KEY` are set. The nightly job stops before any download if `DATABASE_URL` is empty. With the Anthropic secret set, that same run reads up to `MAX_DOCS_PER_RUN` pending loan documents, then rescores. One source failing does not skip the rest. Rotate the database password and the Anthropic key, then update `pipeline/.env`, `web/.env.local`, and those two Actions secrets. Drop in a Fannie or Freddie export only after reading the terms.
