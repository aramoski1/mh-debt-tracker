# Paid upgrades

Not integrated. Listed so the price and the gap are in one place. None of these are scraped.

## Datacomp / JLT market books

The Phoenix manufactured-housing book has been listed at $465. The January 2026 edition covers on the order of 100 communities. It would replace the statewide lot-rent assumption with a rent, a site count, and a vacancy for the parks it names. It does not belong in the pipeline until Cooper Cardinal has a license that allows storing the figures, and then only as a file they place in `data/operating/` and load with `mhdebt ingest operating`.

## HUD fair-market rents

The HUD API is public and wants a token. It is a housing voucher rent, not a manufactured-housing lot rent, so it would be a weak stand-in for the lot-rent assumption. Ask before creating the key.

## CourtListener

A token is required. It would add federal dockets for owner entities. Ask before creating the key. It is not a substitute for the county notices already loaded from the Maricopa recorder.

## CoStar, LoopNet, Crexi, MHVillage, Mobile Home Park Store, MHI Community Attributes

Rejected. Their terms prohibit the kind of collection this desk would need, or the license is view-only. A login, a screenshot pass, and a bulk copy are all out.
