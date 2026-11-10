# Store auth

You're connecting Shopify CLI to one store so the `store-builder` agent and the
twin-dev skills can push themes, create menus and upload files without stopping
for a login. Do it once per store. Logins open a browser, so the user runs them
in their own terminal; you check what's needed and verify it worked.

## 1. Shopify CLI

```bash
shopify version
shopify store auth list --help
```

- `shopify` not found, or older than 5: tell the user to install or update it
  (needs Node.js 22.12+), then run this skill again:
  ```bash
  npm install -g @shopify/cli@latest
  ```
- `store auth list` not found: the CLI is too old. Same command, to update it.

Add `--no-input` to every check below. It stops the CLI from prompting or opening
a browser, so a missing login fails straight away instead of hanging.

## 2. Theme access (push, pull, theme list)

```bash
shopify theme list --store <store>.myshopify.com --no-input --json
```

- It prints the themes: theme access works. Note the live theme's ID (the one
  with role `live`) so you can mention it, and move on.
- It errors, says it needs a login, or says the account has no access: the user
  needs to log in. Give them the command for **step 4**.

## 3. Admin API access (menus, pages, files)

The twin-dev skills need these scopes together:

| Scope | Used by |
|---|---|
| `read_online_store_navigation`, `write_online_store_navigation` | menus |
| `read_products`, `read_content` | menus (linking menu items to products, collections, pages, blogs) |
| `read_legal_policies` | menus (linking Shipping, Returns, Privacy items to store policies) |
| `write_content` | pages (creating pages and assigning templates) |
| `read_files`, `write_files` | files |

Check the stored auth. It's local, read-only and needs no browser:

```bash
shopify store auth list --no-input --json
```

Read only `store`, `scopes`, `expiresAt` and `refreshTokenExpiresAt` from the
output. If it holds anything token-shaped, don't quote or log it.

Find the session whose `store` is this store. Then:

- **No session for the store:** never authorized. Step 4.
- **`expiresAt` is in the past:** the token is online and lasts about 24 hours,
  so this is the usual reason a build that worked yesterday is blocked today.
  Step 4. If `refreshTokenExpiresAt` is still in the future the CLI may renew
  it by itself on the next `store execute`; try step 3's query once before
  asking for a login.
- **A scope is missing:** a `write_X` scope also grants `read_X`, so a stored
  list with only `write_files` still covers `read_files`. A `write_` scope is
  missing only if that exact scope isn't listed; a `read_` scope is missing only
  if neither it nor its `write_` form is. Step 4, always requesting the full
  list so a new auth doesn't drop a scope an earlier one had.

If the stored session looks right, prove it with a read-only query. Write it to a
file in the scratchpad:

```graphql
{ shop { name myshopifyDomain } currentAppInstallation { accessScopes { handle } } }
```

```bash
shopify store execute --store <store>.myshopify.com --query-file <file.graphql> --no-input --json
```

- It returns the shop: admin access works.
- It errors (no token, expired, not authorized): step 4.
- If `currentAppInstallation` itself errors but `shop` works, trust the scopes
  from `store auth list`.

## 4. Log in (user's terminal)

Give the user only the commands that steps 2 and 3 showed are needed, in one
block they can paste into their own terminal (PowerShell or any shell). Each one
opens the browser; they log in with the account that has access to this store
and approve.

```bash
# Theme access
shopify theme list --store <store>.myshopify.com

# Admin API access (expires after about 24 hours; re-run when it does)
shopify store auth --store <store>.myshopify.com --scopes read_online_store_navigation,write_online_store_navigation,read_products,read_content,read_legal_policies,write_content,read_files,write_files
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
| Menus | ready / missing scopes | menus |
| Pages | ready / missing scopes | pages |
| Files | ready / missing scopes | files |

Then the store name, the live theme's name and ID (so nobody pushes to it), when
the Admin API token expires (`expiresAt`, so the user knows how long the build
has), and the next step when everything is ready:

```
Use the store-builder agent: store "<Store name>", Figma <link>, store <store>.myshopify.com
```

If a build was blocked on auth, give the continue line instead:

```
Use the store-builder agent: continue "<Store name>"
```
