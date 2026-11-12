# Decisions

Newest first. Each cycle report lists: shipped, cut (and why), blocked (and on what), coverage before vs after, open defects by severity, and next.

2026-11-12 — Acquisitions-lead approved fixing the nightly park insert before the numbers audit. A new park with a blank phone or website raises `query parameter missing: phone, website`, the open batch rolls back, and the rest of that HIFLD or operating import does not run. Benefit: the park list the desk is built on keeps loading. Use: every nightly run. Trust: main CI, two database tests failed, 71 others passed. Simpler: bind null for every park column the merge leaves blank. No screen change and no migration. PR #1 (`team/numbers-audit`) stays open: its CI is red, and `supabase/migrations/20261111000013_nullable_score.sql` has not been applied to the live project.

2026-11-11 — Docs stay current with the code. `BUILD_GUIDE.md`, `README.md`, `PROJECT_CONTEXT.md`, and `COVERAGE.md` are updated in the same change as the behavior they describe. The nightly secrets and the buyer framing are corrected in those files.

2026-11-11 — User asked for the nightly refresh to actually run. The Action was failing before it reached Supabase: the `DATABASE_URL` secret was empty, and the `jobs` command hid the ingest module. Landed on main so the schedule uses the fix. Document reading is on: the Anthropic key is an Actions secret, and the refresh runs without skipping it.
