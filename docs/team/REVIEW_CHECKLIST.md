# Review checklist

The `code-reviewer` walks this list on every change. The developer adds to it when the same kind of defect shows up twice.

## Data integrity

- [ ] Nightly jobs are idempotent: re-running never duplicates rows (they use the `db.py` upsert helpers).
- [ ] Writers respect field locks (`fieldlock.py`). Recorded, document and hand-entered values are never overwritten by a weaker source.
- [ ] County loan status is set only by `build_county_loans` replaying documents in date order.
- [ ] One source failing never stops the others, and the failure is logged to data issues.
- [ ] New sources go through `PoliteClient` and have a `mhdebt probe` command plus a fixture. No invented endpoint, field or code.

## Security

- [ ] Every new table has RLS enabled and policies in the same migration. Internal tables aren't readable by `anon`.
- [ ] No secret in code, fixtures, logs or demo data. Service-role keys only on the server.
- [ ] API routes check the session and validate input on the server.
- [ ] AI calls are forced tool calls validated on the server before any write. The AI never writes or sends without a user click.

## Honesty and provenance

- [ ] Every number shows its provenance and as-of date. Estimates show a range.
- [ ] Assumed inputs (rent, occupancy, expenses) are labeled where the number is shown.
- [ ] Outreach drafts never cite estimated debt or distress to an owner.
- [ ] Empty states say whether something wasn't checked, wasn't found, or doesn't exist.

## Correctness

- [ ] Nulls and missing data are handled everywhere a value can be absent (maturity, NOI, sites, owner).
- [ ] Units are consistent: monthly vs annual, percent vs decimal, bps.
- [ ] Python and TypeScript versions of the same formula agree (the numbers-auditor checks this).
- [ ] Dates are timezone-safe. Date-only values aren't shifted by local time.

## Product and code health

- [ ] Demo mode works for every changed screen, with fictional data.
- [ ] Migrations are new files; no edits to an applied migration.
- [ ] Tests cover the main path and the bug most feared, and fail if it returns.
- [ ] Lists stay fast at 10,000 rows. No N+1 queries per row.
- [ ] Accessibility: labeled controls, keyboard reachable, visible focus.
- [ ] `BUILD_GUIDE.md`, page guides and copilot knowledge are updated for user-visible changes.
