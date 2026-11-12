# Team cycle

Run the team cycle from `.cursor/rules/team.mdc`, end to end, on the next work.

1. Read:
   - `docs/team/BACKLOG.md`, `docs/team/DECISIONS.md`, and the last three entries of `docs/team/TEST_LOG.md` and `docs/team/DATA_LOG.md`
   - `docs/COVERAGE.md`
2. **If the backlog has fewer than five open items,** refill it first:
   - **Data audit:** ask `data-scout` (in the background) to audit coverage and accuracy and propose the five highest-value data moves.
   - **Desk walkthrough:** at the same time, ask `acquisitions-lead` to walk the core workflow in demo mode and list what blocks him from using the app every morning.
   - Merge both into one ranked backlog. Rank by how much the item would change a buy decision, then by effort.
   - **Value test:** a new feature or improvement goes in when the acquisitions-lead says it has a clear benefit. Otherwise record it as "Later" in `DECISIONS.md`.
3. **Work the top items.** Take up to three unblocked items, one at a time. For each one, follow steps 2–8 of the cycle: scope with `acquisitions-lead`, data from `data-scout`, build, check, test, fix, close.
4. **Stop** when three items are closed, when you hit something that needs the user, or when you run low on context.
5. **Write a cycle report** at the top of `docs/team/DECISIONS.md`:
   - shipped
   - cut, and why
   - blocked, and on what
   - coverage before vs after
   - open defects by severity
   - what the next cycle should do first
6. **Give the user a short summary** and any approvals you need.
