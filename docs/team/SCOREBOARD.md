# Scoreboard

Whether the app is actually getting better. The developer updates it at the end of every cycle: add a dated column, and never overwrite history.

Baseline: Arizona, 2,249 parks, from `docs/AUDIT.md`, October 30, 2026.

## Data (share of Arizona parks)

| Metric | 2026-10-30 | 2026-11-12 |
|---|---:|---:|
| Owner of record | 34% | 34% (not remeasured) |
| Owner grouped with related entities | not measured | not measured |
| Any loan on record | 13% | 13% (not remeasured) |
| Open loan, reported or document maturity | 2% | 2% (not remeasured) |
| Open loan, estimated maturity | 8% | 8% (not remeasured) |
| Distress signal tied to a park (24 months) | 0% | 0% |
| Sale comp within 25 miles in 3 years | not measured | not measured |
| Operating figures (rent, occupancy) | 0% | 0% |
| Park → parcel top-1 match rate (labeled set) | no labeled set | no labeled set |
| Maturity estimates: known dates inside p10–p90 | not measured | not measured |

## Product

| Metric | 2026-10-30 | 2026-11-12 |
|---|---:|---:|
| Highest owner-pressure score on the live list | 50.5 | 50.5 (not remeasured) |
| Parks scoring 45+ | 5 | 5 (not remeasured) |
| Core-workflow e2e test | none | none |
| Open defects: blocker / major / minor | not tracked | 0 / 0 / 1 |
| Golden parks passing | none yet | none yet |
| Items shipped / cut this cycle | — | 1 / 0 |

The minor defect on 2026-11-12: a park row with no name still cannot be stored, because `parks.name` is not null, and that row still rolls back the open batch. Coverage figures were not remeasured.
