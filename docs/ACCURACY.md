# Accuracy

Checked 2026-10-30 against the loans already in the database. These are the measured numbers. They are not a calibration target.

## Term prior versus a stated maturity

`mhdebt holdout` ignores the maturity on the filing and asks the term prior where that loan would land. It then compares that date with the maturity the filing stated.

| | |
|---|---|
| Loans with a stated maturity and a start date | 97 |
| Median absolute error | 60 months |
| Within 12 months of the stated date | 26 |
| Within 24 months | 35 |

A date the model estimated is not a date from the note. The prior is a weak substitute for a stated maturity, which is why the park page says so when the basis is estimated.

## What this is not

Parcel records keep the latest sale, not the sale history. A backtest of "who sold in the year after the estimated maturity, using only documents that existed on a past date" cannot be run from the columns we have. It is not reported here.

## Spreads in the model

Measured on 2026-10-30 as note rate minus the 5-year Treasury on the origination date. A row is used in the score only when the sample has at least 8 loans.

| Source | Lender type | Median spread | Loans |
|---|---|---|---|
| CMBS | CMBS | 2.64 pts | 33 |
| SBA | Community bank | 4.77 pts | 17 |
| SBA | Credit union | 3.87 pts | 17 |
| SBA | National bank | 4.18 pts | 13 |
| SBA | Regional bank | 4.19 pts | 15 |

Agency, life company, and debt-fund spreads are still the assumed table. There are no loans of those types with a note rate in the database.

The 75% loan-to-value cap is applied only when someone has saved a price on that park. With no price, the refinance gap uses the 1.25 debt-service test alone.

## Rates loaded

Prints stored through 2026-10-28 (SOFR through 2026-10-29): 5-year Treasury 4.85%, 7-year 4.95%, 10-year 5.05%, prime 7.00% on 2026-10-27, Moody's Baa spread 1.43 points, SOFR 3.94%.

## Flood

The FEMA zone was written for the first 25 parks that had a coordinate and no zone yet. The nightly run fills 100 more each time. A park with no zone yet shows a blank, not a guess.
