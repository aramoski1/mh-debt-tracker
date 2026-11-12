# Team cycle

Run the team cycle from `.cursor/rules/team.mdc`, end to end.

1. **Load state.** Read:
   - `docs/team/BACKLOG.md` and `docs/team/SCOREBOARD.md`
   - the top of `docs/team/DECISIONS.md`
   - the last three entries of `TEST_LOG.md` and `DATA_LOG.md`
   - `docs/COVERAGE.md`
2. **Refill the backlog if it has fewer than five open items.** In parallel:
   - **Data:** ask `data-scout` to audit coverage and accuracy and propose the five highest-value data moves.
   - **Product:** ask `acquisitions-lead` to walk the core workflow in demo mode with the Browser subagent. He lists what blocks daily use, plus new features or improvements with a clear benefit.
   - **Merge and rank:** merge both into one ranked backlog. Wrong numbers and broken workflows first, then by value to a buy decision, then by effort.
   - **Value test:** a new feature or improvement goes in when the acquisitions-lead says it has a clear benefit. Otherwise record it as "Later" in `DECISIONS.md`.
3. **Work the top items.** Take up to three unblocked items, one at a time:
   1. scope (lead, plus scout if needed)
   2. build
   3. self-check
   4. review (reviewer, plus auditor if numbers changed)
   5. test (lead)
   6. fix
   7. close, only when every quality gate passes
4. **Stop** when three items are closed, when something needs the user, or when context runs low.
5. **Report.** Update `SCOREBOARD.md`. Write the cycle report and a two-line retro at the top of `DECISIONS.md`:
   - shipped
   - cut, and why
   - blocked, and on what
   - scoreboard before vs after
   - open defects by severity
   - what the next cycle should do first
6. **Summarize for the user.** Give a short summary, the pull requests to review, and any approvals you need.
