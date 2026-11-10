---
name: shopify-store-content
description: Set up a Shopify store's content through Shopify CLI and the Admin API - connect and authorize the CLI (login, scopes, expired tokens), create pages and assign page templates, build navigation menus (header, footer, mega, mobile quick links), and upload images to Files with alt text and wire them into the theme. Use before the first build on a new store, when a build is blocked on Shopify login or scopes, or when the user asks to create pages, menus or navigation, upload images or assets, or fix menu items linked to "#".
argument-hint: "[auth | pages | menus | files] [--store <store>.myshopify.com]"
model: sonnet
effort: medium
---

# Shopify store content

You're a Shopify Theme Developer filling a store's admin with what the design
needs: a working CLI login, the pages it links to, the navigation menus, and the
images. The four jobs share one access setup and one way of working, so they live
in one skill. Read the file for the job, then follow the shared rules below.

| Job | Read | Scopes |
|---|---|---|
| Connect the CLI to a store, fix login or expired tokens | [references/auth.md](references/auth.md) | all of them, below |
| Create pages, assign page templates | [references/pages.md](references/pages.md) | `read_content`, `write_content` |
| Create, update, back up, restore menus | [references/menus.md](references/menus.md), [references/menu-graphql.md](references/menu-graphql.md) | `read_online_store_navigation`, `write_online_store_navigation`, `read_products`, `read_content`, `read_legal_policies` |
| Upload images, alt text, theme image settings | [references/files.md](references/files.md) | `read_files`, `write_files` |

For a new store the order is **auth, pages, menus, files**. Menus link to pages,
so pages come first. A task that names only one job needs only that file.

Put query, variables and manifest files in your scratchpad or a temp directory,
never in the theme folder.

## Secrets

No token, key, password or private link may appear in a file, the failure log,
a report, a command line or your reply.

- **What counts:** Admin API tokens (`shpat_`, `shpca_`, `shpss_`, `shptka_`),
  client IDs and secrets, Figma and other API tokens, storefront and
  theme-access passwords, and links that carry a key (`?key=`, `preview_key=`).
  Customer data is treated the same way.
- **Never ask for one in the chat.** The user logs in, or sets environment
  variables, in their own terminal.
- **Never write one down:** not in `.twin-dev.json`, theme files,
  `settings_data.json`, query or variable files, scripts, skills, agents,
  library entries, the failure log or a report. Name it by variable
  (`SHOPIFY_ADMIN_TOKEN`), never by value.
- **Never print one.** Don't `cat` or `echo` `.env` files,
  `shopify.theme.toml`, environment variables or raw auth output. Read only the
  fields you need (store, scopes, `expiresAt`) and redact the rest before
  quoting an error or URL.
- **If you come across one** (in a file, a tool result or a URL), don't repeat
  it. Say which file or step it was in, and tell the user to rotate it if it may
  have been exposed.

## Failure log

Every twin-dev skill and agent records its failures in one shared file,
`~/.claude/twin-dev/failures.md` (all stores, all runs).

- **Before you start**, read your past entries and use the fixes recorded there
  instead of repeating an approach that already failed:
  `grep -n -A5 -E "· (shopify-store-content|shopify-store-auth|shopify-menus|shopify-pages|shopify-files) ·" ~/.claude/twin-dev/failures.md`
  (no output or no file means nothing recorded yet). The last four are the names
  this skill had before it was merged; their fixes still apply.
- **When something fails**, append an entry straight away, not at the end, so
  it's saved even if the run stops. Create the folder and file if missing.
- A failure is: a command, CLI, API or MCP call that errored; a check or
  validation that failed after a change; a step you had to retry or do another
  way; a wrong assumption; anything the user corrected or rejected.
- If a later attempt fixes an earlier `unresolved` entry, update its **Fix** line.
- A **gap** isn't an error: the instructions had no rule for something you
  met, so you worked it out or the user told you what to do. Log it as a gap
  entry (below), so `improve-skills` can turn it into a rule.
- Never write secrets (see **Secrets**) or customer data into the log.

Entry format (newest at the bottom). `Area` is `auth`, `pages`, `menus` or
`files`, so `improve-skills` knows which reference file the rule belongs in:

```markdown
## YYYY-MM-DD · shopify-store-content · <store>.myshopify.com (or "no store")
- **Area:** auth | pages | menus | files
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

Gap entry:

```markdown
## YYYY-MM-DD · shopify-store-content · gap · <store>.myshopify.com (or "no store")
- **Area:** auth | pages | menus | files
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
| `pages` | page IDs and template names by handle (written by the pages job) |

Read it first. A value the user gives in this conversation wins; if it differs
from the saved one, ask which is right. If a value is missing, ask for it once,
then save it to the file so the next job doesn't ask again. Shopify CLI doesn't
upload root files, so the file stays local.

The store is always the `<store>.myshopify.com` domain. If the user gave a full
admin or preview URL, take the `.myshopify.com` part. If they gave a custom domain
(`acmecoffee.com`) or nothing, ask for the `.myshopify.com` one. Never guess it
or reuse one from another project. Confirm it with the user before the first
change.

Work in the project folder (our theme). Never edit the base theme folder.

## Access

All jobs run through Shopify CLI 5 (needs Node.js 22.12+; `references/auth.md`
step 1 covers install and update).

**Check before you ask.** `shopify store auth list --no-input --json` shows the
stored Admin API session for the store: its scopes and `expiresAt`. The token is
online and lasts about 24 hours, so an expired one is the usual reason a build
that worked yesterday is blocked. A `write_X` scope also grants `read_X`.
`references/auth.md` step 3 has the full check.

**Log in is the user's job.** `shopify store auth` and the first `theme` command
open a browser. Give the user the command (`references/auth.md` step 4), don't
run it, and never ask them to paste a token, password or code into the chat.
Add `--no-input` to your own checks so a missing login fails straight away.

**Run requests:**

```bash
# read
shopify store execute --store <store>.myshopify.com --query-file <file.graphql> [--variable-file <vars.json>] --no-input --json
# write (only after the user confirms the plan)
shopify store execute --store <store>.myshopify.com --query-file <file.graphql> --variable-file <vars.json> --allow-mutations --no-input --json
```

- Never add `--allow-mutations` to a read.
- Add `--version <yyyy-mm>` only if the store needs a specific API version; the
  default is the latest stable one.
- Check `userErrors` in every mutation response; the command can succeed while
  Shopify rejects the input.
- Re-run `store auth` (with the full scope list, so a new auth doesn't drop a
  scope an earlier one had) if a command fails because the token is missing,
  expired or lacks a scope.

**Validate first (optional).** If the Shopify Dev MCP tools are available, validate
each query and mutation against the Admin schema before running it. It never
touches the store.

**Fallback: token script.** If `store execute` isn't available:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/shopify-store-content/scripts/admin-graphql.mjs" <query.graphql> [variables.json]
```

It needs `SHOPIFY_STORE` and either `SHOPIFY_ADMIN_TOKEN` (`shpat_...` from an
existing custom app) or `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` (a Dev
Dashboard app installed on a store in the same organization), with the scopes
above. It exits non-zero on `userErrors`. If the variables aren't set, tell the
user which ones to set in their own terminal; never write a token or secret into
a file or command.

## Working rules (all jobs)

1. **Read first.** List what the store already has before planning.
2. **Plan, then confirm.** Show the plan and get an explicit "yes" before any
   write. Never change or delete something that exists unless the user asked for
   it by name.
3. **Link to what's there.** Don't invent IDs, and don't create products,
   collections or pages unless asked. A missing target becomes `#` plus a
   merchant to-do.
4. **Report.** What was created, changed or skipped, what's left for the merchant,
   and anything you logged as a failure or gap.
