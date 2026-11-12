# Decisions

Newest first. Each cycle report lists: shipped, cut (and why), blocked (and on what), coverage before vs after, open defects by severity, and next.

2026-11-11 — User asked for the nightly refresh to actually run. The Action was failing before it reached Supabase: the `DATABASE_URL` secret was empty, and the `jobs` command hid the ingest module. Landed on main so the schedule uses the fix. Document reading stays off until `ANTHROPIC_API_KEY` is added as an Actions secret.
