---
name: improve-skills
description: Turn the shared twin-dev failure log (~/.claude/twin-dev/failures.md) into fixes in the twin-dev skills and agents - group failures and gaps by skill, propose the rule each one needs, edit the plugin source in the twin-dev repo after the user approves, and mark the entries as promoted. Use when the user asks to improve or update the skills from failures, review the failure log, or "learn from" past runs, or after a store build that logged failures or gaps.
argument-hint: "[skill or agent name] [--since YYYY-MM-DD]"
---

# Improve skills

You maintain the twin-dev plugin. Every skill and agent appends its failures and
gaps to `~/.claude/twin-dev/failures.md`. That log only lives on this computer;
a fix is shared with the team once it's written into the skill itself and
committed. This skill does that.

## 0. Find the repo

Edit the plugin **source**, never the installed copy under `~/.claude/plugins`
(it's replaced on every update). The source is the twin-dev git repo: the
folder with `plugins/twin-dev/.claude-plugin/plugin.json`.

Look in this order: the current folder, `$TWIN_DEV_REPO`, `twinDevRepo` in
`~/.claude/twin-dev/config.json`. If none is set, ask once and save the answer
as `twinDevRepo` in that config file.

Run `git -C "<repo>" status -sb`. If it's behind its remote, ask whether to pull
first. If it has uncommitted changes, list them and don't touch those files
unless the user says so.

## 1. Read the log

Read `~/.claude/twin-dev/failures.md`. No file or no entries: say so and stop.

Skip entries that already have a `**Promoted:**` or `**Dismissed:**` line. If
the user named a skill, agent or date, keep only those entries.

Two kinds of entry:

- **Failure** (`## <date> · <name> · <store>` with Tried / Failed / Cause / Fix).
- **Gap** (`## <date> · <name> · gap · <store>` with Missing / Did): the
  instructions had no rule, so the agent worked it out or the user told it.

## 2. Sort each entry

| Verdict | When | What happens |
|---|---|---|
| **Promote** | A gap; a user correction; the same failure twice or more (any store); a single failure whose **Fix** is a general rule (a missing scope, a wrong flag, an API field that changed, a step in the wrong order). | Write the rule into the skill or agent. |
| **Wait** | A one-off failure with no clear cause, or `Fix: unresolved`. | Leave it. Mention it in the report. |
| **Dismiss** | Specific to one store's data (a missing product, a merchant setting), a network blip, or already covered by the current instructions. | Mark it so it isn't proposed again. |

Before promoting, read the target `SKILL.md` or agent file in the repo and check
whether the rule is already there (an earlier promotion, or a manual edit). If
it is, the verdict is **Dismiss** ("already covered").

Pick the file the rule belongs in. That's usually the entry's own skill, but a
failure logged by `store-builder` while it followed `shopify-menus` belongs in
`shopify-menus`. A query or API detail goes in the skill's `references/` file.
A rule several skills need (an auth scope, for example) goes in each of them,
and in `shopify-store-auth` if it's a scope.

## 3. Propose

Show one table per target file:

- the entries (date, store, one-line summary);
- the verdict and why;
- for **Promote**, the exact edit: the section it goes in and the new or changed
  lines, written in the file's own style (short direct sentences, the same
  terms the file already uses).

Rules for the edits:

- Write a rule, not a story. "Request `read_legal_policies` with the menu
  scopes", not "On 2026-10-15 the menu query failed because...".
- Put it where the agent will read it at the right moment (the step where the
  failure happened), not in a new "Lessons" section at the end.
- Change an existing line when it's wrong; don't add a second line that
  contradicts it.
- Never copy store domains, customer data, tokens or keys into a skill.

Wait for the user's yes. They can approve all of it, some of it, or reword it.

## 4. Apply

1. Edit the approved files in the repo.
2. If a skill or agent was added or its description changed, update `README.md`.
3. Bump the minor version in `plugins/twin-dev/.claude-plugin/plugin.json` once
   per run (`1.8.0` → `1.9.0`).
4. Mark each handled entry in `failures.md` by adding one line under it:
   - `- **Promoted:** YYYY-MM-DD → <file path in the repo>`
   - `- **Dismissed:** YYYY-MM-DD, <reason>`

   Never delete entries. The log is the history.
5. Don't commit unless the user asks. When they do, commit only the files you
   changed, with a message listing the rules added.

## 5. Report

- for each file changed, the rules added or changed;
- entries promoted, dismissed (with the reason) and still waiting;
- the new plugin version;
- the next steps: commit and push the repo, and run `/plugin` update on the
  other computers so the team gets the change.

If something fails during this skill, log it like any other skill (failure
entry with `improve-skills` as the name).
