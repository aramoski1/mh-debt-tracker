# The agent team

Three agents develop, test and improve the park debt tracker.

| Agent | Where it's defined | Job |
|---|---|---|
| **Developer** (the main Cursor agent) | `.cursor/rules/team.mdc` | Writes the code. Runs the cycle. Briefs the other two and carries information between them. |
| **acquisitions-lead** | `.cursor/agents/acquisitions-lead.md` | Senior park acquisitions principal. Decides what's needed (and cuts what isn't). Tests everything in the running app. |
| **data-scout** | `.cursor/agents/data-scout.md` | Finds and verifies every usable public source, traces paid vendors to their public origins, writes source modules and probes, and measures coverage and accuracy. |

## Knowledge and shared state

| File | Purpose |
|---|---|
| `ACQUISITIONS_PLAYBOOK.md` | Industry knowledge for the acquisitions-lead |
| `DATA_PLAYBOOK.md` | Vendor dissection and accuracy method for the data-scout |
| `BACKLOG.md` | The single ranked work list |
| `DECISIONS.md` | Cycle reports and decisions |
| `TEST_LOG.md` | Test sessions |
| `DATA_LOG.md` | Data findings |
| `sources/` | One spec per source |
| `screens/` | Test screenshots |

## How to run it

**Run a full cycle.** In Cursor's Agent chat, type `/team-cycle`. It:
1. picks up to three backlog items
2. scopes each with the acquisitions-lead
3. gets data from the data-scout
4. builds, tests, fixes and closes each item
5. writes a cycle report

**Call one agent directly:**
- `/acquisitions-lead test the pipeline page`
- `/data-scout find a free source for Pinal recorder documents`

**Run without you watching:** start a Cursor background or cloud agent with "Run the team cycle in `.cursor/commands/team-cycle.md`." Local slash commands may not load in cloud agents, so name the file. Run it again whenever it finishes. Each run is one cycle. Nothing loops forever without you.

## What needs you

The agents stop and ask before they:
- create any account, API key or token, or file a records request
- run a migration on the real Supabase project, or delete or overwrite real data
- add anything that costs money
- remove a shipped feature

**Auto-merge to `main`:** **off**. The developer opens a pull request per item. Change this line to "on" to let it merge after tests pass and the acquisitions-lead says `ship`.

## Cost

Each subagent uses its own tokens. A cycle with both subagents costs roughly three times a normal agent session. Keep cycles to three items.
