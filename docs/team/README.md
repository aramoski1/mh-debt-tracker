# The agent team

Five agents develop, test and improve the park debt tracker. The developer leads, and four specialists each own one kind of judgment.

| Agent | Defined in | Owns |
|---|---|---|
| **Developer** (the main Cursor agent) | `.cursor/rules/team.mdc` | Writes the code. Runs the cycle. Briefs the others and carries their findings between them. |
| **acquisitions-lead** | `.cursor/agents/acquisitions-lead.md` | What gets built. A senior park acquisitions principal who approves features and improvements with a clear benefit, cuts clutter, and tests everything hands-on in the running app through the Browser subagent. |
| **data-scout** | `.cursor/agents/data-scout.md` | What is true. Finds and verifies every usable public source, traces paid vendors to their public origins, writes source modules and probes, and measures coverage and accuracy. |
| **numbers-auditor** | `.cursor/agents/numbers-auditor.md` | Whether every number is right. Recomputes each formula and score independently, maintains golden test parks, and checks that estimates are labeled honestly. |
| **code-reviewer** | `.cursor/agents/code-reviewer.md` | Whether the code is safe to ship. Read-only review of every change: correctness, data integrity, RLS, tests. |

## How a change moves through the team

```
backlog item
  → scope:  acquisitions-lead (+ data-scout if data is needed)    [in parallel]
  → build:  developer, on a branch, then self-check (tests, typecheck, demo build, e2e)
  → review: code-reviewer (+ numbers-auditor if numbers changed)  [in parallel]
  → test:   acquisitions-lead in the running app
  → fix and re-test (two rounds max, then the user decides)
  → close:  all quality gates pass → pull request → scoreboard and decisions updated
```

## Knowledge and shared state (`docs/team/`)

| File | Purpose |
|---|---|
| `ACQUISITIONS_PLAYBOOK.md` | Industry knowledge for the acquisitions-lead |
| `DATA_PLAYBOOK.md` | Vendor dissection and accuracy method for the data-scout |
| `NUMBERS_SPEC.md` | Canonical formulas and conventions, owned by the numbers-auditor |
| `REVIEW_CHECKLIST.md` | What the code-reviewer checks; grows when a defect recurs |
| `SCOREBOARD.md` | Data coverage, accuracy and product metrics per cycle |
| `BACKLOG.md` | The single ranked work list |
| `DECISIONS.md` | Cycle reports, decisions, retros |
| `TEST_LOG.md` | Test sessions |
| `DATA_LOG.md` | Data findings |
| `sources/` | One spec per source |
| `screens/` | Test screenshots |

## How to run it

1. In Cursor, pull the latest `main`.
2. Use your strongest model for the main Agent chat. Turn on Max Mode if your plan has it; otherwise Cursor may run the subagents on a smaller model.
3. Type `/team-cycle`.

Each run works up to three backlog items through the full loop and writes a report. Run it again for the next round.

**Call one agent directly:**
- `/acquisitions-lead test the pipeline page`
- `/numbers-auditor check the refinance gap on the park page`
- `/data-scout find Pinal recorder access`
- `/code-reviewer review my last commit`

**Run without you watching:** start a Cursor background or cloud agent with "Run the team cycle in `.cursor/commands/team-cycle.md`." Local slash commands may not load in cloud agents, so name the file.

## What needs you

The team stops and asks before it:
- creates any account, API key or token, or files a records request
- runs a migration on the real Supabase project, or deletes or overwrites real data
- adds anything that costs money
- removes a shipped feature

**Auto-merge to `main`:** **on**. Merge automatically when every quality gate passes and CI is green. Otherwise leave the pull request open and report why.

## Cost

Each subagent uses its own tokens. Expect a full cycle to cost roughly four to five times a normal agent session.
