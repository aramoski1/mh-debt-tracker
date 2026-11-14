# Scoreboard

Whether the app is actually getting better. The developer updates it at the end of every cycle: add a dated column, and never overwrite history.

Baseline: Arizona, 2,249 parks, from `docs/AUDIT.md`, October 30, 2026.

## Data (share of Arizona parks)

| Metric | 2026-10-30 | 2026-11-11 | 2026-11-12 | 2026-11-13 | 2026-11-13 walk |
|---|---:|---:|---:|---:|---:|
| Owner of record | 34% | not remeasured | not remeasured | not remeasured | not remeasured |
| Owner grouped with related entities | not measured | not remeasured | not remeasured | not remeasured | not remeasured |
| Any loan on record | 13% | not remeasured | not remeasured | not remeasured | not remeasured |
| Open loan, reported or document maturity | 2% | not remeasured | not remeasured | not remeasured | not remeasured |
| Open loan, estimated maturity | 8% | not remeasured | not remeasured | not remeasured | not remeasured |
| Distress signal tied to a park (24 months) | 0% | not remeasured | not remeasured | not remeasured | not remeasured |
| Sale comp within 25 miles in 3 years | not measured | not remeasured | not remeasured | not remeasured | not remeasured |
| Operating figures (rent, occupancy) | 0% | not remeasured | not remeasured | not remeasured | not remeasured |
| Park → parcel top-1 match rate (labeled set) | no labeled set | not remeasured | not remeasured | not remeasured | not remeasured |
| Maturity estimates: known dates inside p10–p90 | not measured | not remeasured | not remeasured | not remeasured | not remeasured |

## Product

| Metric | 2026-10-30 | 2026-11-11 | 2026-11-12 | 2026-11-13 | 2026-11-13 walk |
|---|---:|---:|---:|---:|---:|
| Highest owner-pressure score on the live list | 50.5 | not remeasured | not remeasured | not remeasured | not remeasured |
| Parks scoring 45+ | 5 | not remeasured | not remeasured | not remeasured | not remeasured |
| Core-workflow e2e test | none | none | none | 6 demo tests | 7 demo tests |
| Open defects: blocker / major / minor | not tracked | 0 / 0 / 1 | 0 / 0 / 2 | 0 / 0 / 2 | 0 / 2 / 5 |
| Golden parks passing | none yet | 12 | 12 | 12 | 12 |
| Items shipped / cut this cycle | — | 1 / 0 | 1 / 0 | 1 / 0 | 1 / 0 |

The minor on 2026-11-11 is a dev-server hydration warning on the nav link. It did not blank a number.

The second minor, found 2026-11-12: a park row with no name still cannot be stored, because `parks.name` is not null, and that row still rolls back the open batch. Coverage figures were not remeasured.

On 2026-11-13 the core-workflow check is `npm run e2e`: six demo tests, with the clock pinned to 2026-11-12. Coverage was not remeasured.

The same day's walk found two majors that are still open: the owner dossier prints a blank balance as $0 and hides another park with the same recorded name, and a park with no deal shows Stage = Target. The call-line major is fixed. The five minors are the nameless-park load, the nav hydration warning, a rate-shock cell when the coupon is estimated, a fit total that includes an unscored distance, and a rent notebook that does not say it is not that park's rent. `/freshness` was marked cut and was not removed.
