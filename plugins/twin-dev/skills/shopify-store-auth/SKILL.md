---
name: shopify-store-auth
description: Connect Shopify CLI to a store before a build - check the CLI is installed, log in for theme pushes, and authorize the Admin API scopes the twin-dev skills need (menus, pages, files, products), then verify both. Use before the first store-builder run on a new store, or when a build is blocked on Shopify login or store auth.
argument-hint: "<store>.myshopify.com"
---

# Shopify store auth

You're connecting Shopify CLI to one store so the `store-builder` agent and the
twin-dev skills can push themes, create menus and upload files without stopping
for a login. Do it once per store. Logins open a browser, so the user runs them
in their own terminal; you check what's needed and verify it worked.

## Failure log

Every twin-dev skill and agent records its failures in one shared file,
`~/.claude/twin-dev/failures.md` (all stores, all runs).

- **Before you start**, read your past entries and use the fixes recorded there
  instead of repeating an approach that already failed:
  `grep -n -A5 "· shopify-store-auth ·" ~/.claude/twin-dev/failures.md` (no output or no
  file means nothing recorded yet).
- **When something fails**, append an entry straight away, not at the end, so
  it's saved even if the run stops. Create the folder and file if missing.
- A failure is: a command, CLI, API or MCP call that errored; a check or
  validation that failed after a change; a step you had to retry or do another
  way; a wrong assumption; anything the user corrected or rejected.
- If a later attempt fixes an earlier `unresolved` entry, update its **Fix** line.
- Never write passwords, tokens, API keys or customer data into the log.

Entry format (newest at the bottom):

```markdown
## YYYY-MM-DD · shopify-store-auth · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

## 0. The store

Use the `<store>.myshopify.com` domain the user gave. If they gave a full admin
or preview URL, take the `.myshopify.com` part. If they gave a custom domain
(`acmecoffee.com`) or nothing, ask for the `.myshopify.com` one. Never guess it.

If you're in a project folder with `.twin-dev.json`, use its `store` when the
user gave none, and save the domain to it when it was empty.

## 1. Shopify CLI

```bash
shopify version
shopify store execute --help
```

- `shopify` not found: tell the user to install it (needs Node.js 20+), then
  run this skill again:
  ```bash
  npm install -g @shopify/cli@latest
  ```
- `store execute` not found: the CLI is too old. Same command, to update it.

## 2. Theme access (push, pull, theme list)

Check it with a short timeout (60 seconds), so a login prompt doesn't hang:

```bash
shopify theme list --store <store>.myshopify.com --json
```

- It prints the themes: theme access works. Note the live theme's ID so you can
  mention it, and move on.
- It asks to log in, times out, or says the account has no access: the user
  needs to log in. Give them the command for **step 4**.

## 3. Admin API access (menus, files)

The twin-dev skills need these scopes together:

| Scope | Used by |
|---|---|
| `read_online_store_navigation`, `write_online_store_navigation` | `shopify-menus` |
| `read_products`, `read_content` | `shopify-menus` (linking menu items to products, collections, pages, blogs) |
| `write_content` | `shopify-pages` (creating pages and assigning templates) |
| `read_files`, `write_files` | `shopify-files` |

Check what's authorized with a read-only query. Write it to a file in the
scratchpad:

```graphql
{ shop { name myshopifyDomain } currentAppInstallation { accessScopes { handle } } }
```

```bash
shopify store execute --store <store>.myshopify.com --query-file <file.graphql> --json
```

- It returns the shop and every scope above: admin access works.
- It errors (no token, expired, not authorized) or a scope is missing: give the
  user the command for **step 4**. Always request the full list, so a new auth
  doesn't leave out a scope an earlier one had.
- If `currentAppInstallation` itself errors but `shop` works, ask for the full
  scope list anyway; you can't tell which scopes are there.

## 4. Log in (user's terminal)

Give the user only the commands that steps 2 and 3 showed are needed, in one
block they can paste into their own terminal (PowerShell or any shell). Each one
opens the browser; they log in with the account that has access to this store
and approve.

```bash
# Theme access
shopify theme list --store <store>.myshopify.com

# Admin API access
shopify store auth --store <store>.myshopify.com --scopes read_online_store_navigation,write_online_store_navigation,read_products,read_content,write_content,read_files,write_files
```

Don't run them yourself: they wait for a browser login. Don't ask the user to
paste a token, password or code into the chat. When they say it's done, go to
step 5.

## 5. Verify

Run steps 2 and 3 again. If one still fails, show the error, log it, and give
the likely cause:

- "Not authorized" or no themes: the account isn't a staff member or
  collaborator on this store, or lacks the Themes permission.
- A scope is still missing: the account's staff permissions don't allow it
  (Navigation, Files, Products, Pages, Themes), or the store owner has to approve.
- The store doesn't exist: the `.myshopify.com` domain is wrong.

## 6. Report

| Access | Status | Used for |
|---|---|---|
| Theme | ready / needs login | push unpublished theme, deploy |
| Menus | ready / missing scopes | `shopify-menus` |
| Pages | ready / missing scopes | `shopify-pages` |
| Files | ready / missing scopes | `shopify-files` |

Then the store name, the live theme's name and ID (so nobody pushes to it), and
the next step when everything is ready:

```
Use the store-builder agent: store "<Store name>", Figma <link>, store <store>.myshopify.com
```

If a build was blocked on auth, give the continue line instead:

```
Use the store-builder agent: continue "<Store name>"
```
