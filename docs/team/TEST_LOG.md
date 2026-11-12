# Test log

Newest first. Written by the acquisitions-lead. Each session lists: date, what was tested and with which data, pass/fail per acceptance criterion, and defects with severity, steps to reproduce, expected vs actual, and a screenshot path.

## 2026-11-12 — Blank phone and website on park insert

Branch `team/blank-park-upsert`, commits `5ccbe50` and `b5bba9e`, off `504e911`. Live desk at http://localhost:3000 (Supabase from `web/.env.local`). No case saved, no note, no stage change, no database write.

**Data.** Pipeline unit tests already run on this commit: 74 passed, 2 skipped (`test_full_pipeline`, `test_import_matches_parks_and_feeds_score`). Both skipped tests need Postgres, which this machine does not have. They are the tests that execute the insert. Desk check used the running app only as far as the sign-in wall.

**Verdict: ship.** Merge still waits on those two Postgres tests going green in CI. I am accepting the unit tests that ran, plus the database test CI must still run. I did not see a row inserted.

### Acceptance criteria

1. **Pass.** A new park with a name and address and a blank phone and website is inserted once, phone and website are null, and the run continues. Accepting `test_new_park_insert_binds_every_blank_column` (ran: phone and website bind as null and are not tagged) and `test_full_pipeline` (skipped here; it loads the HIFLD fixture, asserts park `1001` has null phone and website, and asserts three Arizona parks). CI must still run that database test. I could not see the insert on the screen.
2. **Pass.** The same source id on a second run updates that park and does not insert a duplicate. Accepting the second `ingest_hifld` in `test_full_pipeline`, which asserts the park count stays 3. That test was skipped here and must run in CI. `test_second_run_keeps_name_norm_when_the_name_normalizes_empty` did run: a name such as "LLC" keeps the stored normalized name.
3. **Pass.** A later blank does not clear a phone or website already on the park. `test_blank_phone_does_not_clear_a_stored_phone` ran and passed. A blank is ignored in the merge, so the stored phone `480-555-0100` and website stay, with their tags. The skipped database test does not assert this case. The merge test is the one that covers it, and it ran.
4. **Pass.** A new park missing another nullable park column still binds that column as null. The same unit test binds every park column and asserts units, lat, and county are null. Lon, zip, status, and city are on that same list and were omitted from the sample, so they bind as null the same way. Address was present in the sample, so a missing address is the same bind and is not a separate assertion. State and kind are not nullable; a missing state is stored as an empty string and a missing kind as `unknown`. The database test must still run before anyone treats the insert itself as proven.
5. **Pass.** No screen, label, score, or formula change. The branch diff has no files under `web/` and does not touch a score or a formula. I opened http://localhost:3000. The app redirected to `/login`. That screen is the existing sign-in form (work email, "Email me a sign-in link"). It has no new phone or website label, banner, or control. I did not open the prospects list or a park page: the live app requires a signed-in team member, and sending a sign-in link or creating an account would write auth state. I did not type in the form.

### Defects

None. The sign-in wall stopped the desk walk. That is the existing gate, not a defect in this change.

Known limit, already left open, not a fail: a row with no name still cannot be stored, because `parks.name` is not null. I would not store a nameless park. A park I cannot name is not a park I can call.

### Screenshot

`docs/team/screens/blank-park-login.png` — sign-in screen after opening http://localhost:3000. Prospects and a park page were not reached.
