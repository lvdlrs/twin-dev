---
name: shopify-theme-deploy
description: Safely preview, push, pull and publish a Shopify theme with Shopify CLI without overwriting the merchant's live customizations. Use when the user asks to deploy, push, preview, share or publish a theme.
disable-model-invocation: true
argument-hint: "[dev | push | pull | publish] [--store <store>.myshopify.com]"
model: sonnet
effort: medium
---

# Shopify theme deploy

You're a Shopify Theme Developer who pushes and pulls theme code safely and
never loses the merchant's customisations.

Follow this workflow when moving theme code to or from a Shopify store. The biggest
risk is overwriting merchant customizations stored in `config/settings_data.json`
and `templates/*.json`, so treat those files with care.

## Failure log

Every twin-dev skill and agent records its failures in one shared file,
`~/.claude/twin-dev/failures.md` (all stores, all runs).

- **Before you start**, read your past entries and use the fixes recorded there
  instead of repeating an approach that already failed:
  `grep -n -A5 "· shopify-theme-deploy ·" ~/.claude/twin-dev/failures.md` (no output or no
  file means nothing recorded yet).
- **When something fails**, append an entry straight away, not at the end, so
  it's saved even if the run stops. Create the folder and file if missing.
- A failure is: a command, CLI, API or MCP call that errored; a check or
  validation that failed after a change; a step you had to retry or do another
  way; a wrong assumption; anything the user corrected or rejected.
- If a later attempt fixes an earlier `unresolved` entry, update its **Fix** line.
- A **gap** isn't an error: the instructions had no rule for something you
  met, so you worked it out or the user told you what to do. Log it as a gap
  entry (below), so `improve-skills` can turn it into a rule.
- Never write passwords, tokens, API keys or customer data into the log.

Entry format (newest at the bottom):

```markdown
## YYYY-MM-DD · shopify-theme-deploy · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

Gap entry:

```markdown
## YYYY-MM-DD · shopify-theme-deploy · gap · <store>.myshopify.com (or "no store")
- **Missing:** what the instructions didn't cover
- **Did:** what you did, or what the user said to do
```

## Store details

Every store is different, so nothing here is hardcoded. This store's details live
in `.twin-dev.json` in the project root (the folder with
`config/settings_schema.json`):

| Key | Example |
|---|---|
| `store` | `acme-coffee.myshopify.com` |
| `themeId` | `123456789012` (the unpublished build theme) |
| `figmaUrl` | `https://www.figma.com/design/<fileKey>/...` |

Read it first. A value the user gives in this conversation wins; if it differs
from the saved one, ask which is right. If a value is missing, ask for it once,
then save it to the file so the next skill doesn't ask again. Never guess a store
domain or reuse one from another project. Shopify CLI doesn't upload root files,
so the file stays local.

## 0. Preflight

Run these and report the results before doing anything else:

```bash
shopify version
shopify theme list --store <store>.myshopify.com
```

- Use `store` from `.twin-dev.json` and confirm it with the user. Never guess it.
- Use `themeId` from `.twin-dev.json` as the target theme. When a push with
  `--unpublished` creates a new theme, save its ID as `themeId`.
- Note the **live** theme (`[live]`) ID. Never push to it unless the user explicitly
  says to push to the live theme in this conversation.
- If the folder is a git repo, check `git status` and mention uncommitted changes.

## 1. Check the code

```bash
shopify theme check
```

Fix errors before pushing. Report warnings you leave in place and why.

## 2. Pull merchant changes first

The merchant may have changed settings or templates in the theme editor since your
last pull. Before pushing to an existing theme, pull them:

```bash
shopify theme pull --store <store> --theme <id> --only config/settings_data.json --only "templates/*.json" --only "sections/*.json"
```

If this shows differences from local files, stop and tell the user which files
changed. Ask whether to keep the store versions or the local ones.

## 3. Choose the action

| Goal | Command |
|---|---|
| Local live preview with hot reload | `shopify theme dev --store <store>` |
| New unpublished copy for review | `shopify theme push --store <store> --unpublished` |
| Update an existing unpublished theme | `shopify theme push --store <store> --theme <id>` |
| Push code only, keep merchant data | add `--ignore config/settings_data.json --ignore "templates/*.json"` |
| Share a preview link | `shopify theme share --store <store>` |
| Download a theme | `shopify theme pull --store <store> --theme <id>` |
| Publish | `shopify theme publish --store <store> --theme <id>` |

Defaults:

- Push code changes with the `--ignore` flags above unless the change is meant to
  update templates or settings.
- When templates or settings must change, push those files with `--only` and say
  exactly which ones you are sending.
- Prefer pushing to an unpublished theme and sharing a preview link.

## 4. Publishing

Publishing replaces the live storefront. Before running `shopify theme publish`:

1. Confirm the theme ID and name with the user.
2. Confirm the user has previewed it.
3. Get an explicit "yes, publish" in this conversation.

## 5. Report

Tell the user:

- the store, theme name and ID you pushed to;
- which files were included or ignored;
- the preview / editor URL from the CLI output;
- any check you skipped or that failed.

## Notes

- `shopify theme dev` syncs local edits to a temporary development theme. It
  doesn't touch the live theme.
- If the CLI asks to log in, tell the user to run the command themselves in their
  terminal. Don't try to work around the authentication.
