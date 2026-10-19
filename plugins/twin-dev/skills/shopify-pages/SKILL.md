---
name: shopify-pages
description: Create the store's pages (Online Store > Pages) a Figma design links to, and give each one the right page template - matching our theme's template names to the live theme's, and adding a missing template to the live theme as a copy of its page.json so it can be assigned. Includes the standard Visit the Store, All Looks and All Brands pages. Use before creating menus, when the user asks to create or set up pages, assign page templates, or fix menu items linked to "#" because a page is missing.
argument-hint: "[figma.com link] [--store <store>.myshopify.com]"
---

# Shopify pages

You're a Shopify Theme Developer making sure every page the design links to
exists in the store and uses the right template, so menus can link to real
pages instead of `#`. Run this **before** `shopify-menus`.

A page's template is stored on the page (`templateSuffix`: `about` means
`templates/page.about.json`) and shared by every theme. So the name must be one
the live theme has, and our theme must use the same name.

## Failure log

Every twin-dev skill and agent records its failures in one shared file,
`~/.claude/twin-dev/failures.md` (all stores, all runs).

- **Before you start**, read your past entries and use the fixes recorded there
  instead of repeating an approach that already failed:
  `grep -n -A5 "· shopify-pages ·" ~/.claude/twin-dev/failures.md` (no output or no
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
## YYYY-MM-DD · shopify-pages · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

Gap entry:

```markdown
## YYYY-MM-DD · shopify-pages · gap · <store>.myshopify.com (or "no store")
- **Missing:** what the instructions didn't cover
- **Did:** what you did, or what the user said to do
```

## Store details

Read `.twin-dev.json` in the project root (`store`, `figmaUrl`, `themeId`). A
value the user gives in this conversation wins; if it differs from the saved
one, ask which is right. Never guess a store domain.

Work in the project folder (our theme). Never edit the base theme folder.

## 0. Access

Admin API scopes `read_content` and `write_content` (pages), plus theme access
for the live theme. If `shopify store execute` or `shopify theme list` fails for
auth, run the `shopify-store-auth` skill first.

Run requests as the `shopify-menus` skill does:

```bash
shopify store execute --store <store>.myshopify.com --query-file <file.graphql> [--variable-file <vars.json>] --json
# writes only, after the plan is approved (step 4)
shopify store execute --store <store>.myshopify.com --query-file <file.graphql> --variable-file <vars.json> --allow-mutations --json
```

Check `userErrors` in every mutation response.

## 1. List the pages the design needs

Read every menu in the Figma design: header nav, mega menu, mobile drawer,
footer columns, plus buttons and links in page frames. Keep each link that
points to a **page**: About, Contact, FAQ, Stockists, Our Story and the like.
Leave out collections, products, blogs and articles, policies, search, cart,
account and external links; `shopify-menus` handles those.

Add the standard pages:

| Page | Handle | Template | When |
|---|---|---|---|
| Visit the Store | `visit-the-store` | `page.visit-the-store.json` | Always |
| All Looks | `all-looks` | `page.all-looks.json` | Only if the design has a Looks / Shop the Look section or link |
| All Brands | `all-brands` | `page.all-brands.json` | Only if the design has a brand list (brand logos, Brands menu or page) |

For each page note: the title as the design writes it, a handle (the title in
lowercase with hyphens), where it's linked from, and **our template**: the
project's `templates/page.<name>.json` built for it, if any (match by name, for
example "About Us" → `page.about-us.json` or `page.about.json`). If a standard
template is missing from the project, note it.

## 2. Read the store

**Pages.** List every page, following `pageInfo.hasNextPage`:

```graphql
query Pages($after: String) {
  pages(first: 250, after: $after) {
    nodes { id title handle templateSuffix isPublished }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Live theme templates.** Find the live theme in `shopify theme list --store
<store> --json` (role `live`). Pull only its page templates into a scratch folder
(read-only, never the project folder):

```bash
shopify theme pull --store <store>.myshopify.com --theme <liveId> --path <scratch>/live-theme --only "templates/page*" --only layout/theme.liquid --only config/settings_schema.json
```

The layout and config files are only there so the CLI accepts the folder as a
theme when you push from it in step 5.

Record which suffixes live has (`page.about.json` or `page.about.liquid` →
`about`) and whether its default is `page.json` or `page.liquid`.

## 3. Plan each page

**Match it to a store page**: same handle, else same title (case-insensitive).
Never create a second page for one that exists.

**Choose its template name (suffix)**, in this order:

1. The page exists and has a `templateSuffix`: keep it. Never change an existing
   page's template.
2. Live has a template that matches the page: same name as our template, or the
   same after dropping `-us`, `our-`, `-page` (`about` ↔ `about-us` ↔
   `our-about`), or the page's handle. Use live's name.
3. Otherwise use our template's name, or the handle if we have none.

**Rename ours to match.** If the chosen name differs from our template's file
name, rename the file in the project (`page.about-us.json` →
`page.about.json`). If the target name already exists in the project, don't
overwrite it; flag both files in the plan.

**Live template.** If live has no template with the chosen name, plan to add
one: a copy of live's default `page.json` (or `page.liquid`) named
`page.<suffix>.json` (or `.liquid`). The page then looks the same on the live
store as before, the template appears in the admin dropdown, and our theme
renders its own design under the same name.

**Action per page:**

| Store state | Action |
|---|---|
| Missing | Create it: title, handle, template, **published**, empty body. |
| Exists, default template (no suffix) | Assign the chosen template. Change nothing else. |
| Exists, has a template | Nothing in the store. Rename ours to match if needed. |

Never change an existing page's title, handle, body, published state or
non-empty template, and never delete a page.

## 4. Confirm

Show the plan and get a "yes" before any change:

| Page | Linked from | Store | Template | Our file | Live template |
|---|---|---|---|---|---|
| About Us | Header, Footer | exists (default) → assign | `about` | rename `page.about-us.json` → `page.about.json` | exists |
| Visit the Store | standard | create | `visit-the-store` | `page.visit-the-store.json` | add (copy of page.json) |

Say that new pages are published and empty, so they're visible on the live store
until the theme launches, and that live templates are added as copies of the
live `page.json`, so live pages look the same.

## 5. Apply

In this order, so no page points at a template that doesn't exist:

1. **Rename our templates** in the project folder.
2. **Add live templates.** In the scratch folder, copy live's default page
   template to each new name. Check again that live doesn't have it, then push
   only the new files, without deleting anything:
   ```bash
   shopify theme push --store <store>.myshopify.com --theme <liveId> --path <scratch>/live-theme --only templates/page.<suffix>.json --nodelete --allow-live
   ```
   These are the only files ever pushed to the live theme. Never push a
   template from our theme there; its `cc-` sections don't exist on live.
3. **Create and assign pages:**
   ```graphql
   mutation PageCreate($page: PageCreateInput!) {
     pageCreate(page: $page) { page { id handle templateSuffix } userErrors { field message } }
   }
   ```
   `{ "page": { "title": "Visit the Store", "handle": "visit-the-store", "templateSuffix": "visit-the-store", "isPublished": true, "body": "" } }`
   ```graphql
   mutation PageUpdate($id: ID!, $page: PageUpdateInput!) {
     pageUpdate(id: $id, page: $page) { page { id templateSuffix } userErrors { field message } }
   }
   ```
   `{ "id": "gid://shopify/Page/123", "page": { "templateSuffix": "about" } }`
4. **Push our theme** if the project has a `themeId` and templates were renamed
   (`shopify-theme-deploy`), so the unpublished theme has the new names.

## 6. Save and report

Save every page to `.twin-dev.json` under `pages`, keyed by handle, so
`shopify-menus` links to them and later runs don't redo them:

```json
"pages": {
  "about": { "id": "gid://shopify/Page/123", "title": "About Us", "templateSuffix": "about", "created": false, "liveTemplateAdded": false },
  "visit-the-store": { "id": "gid://shopify/Page/456", "title": "Visit the Store", "templateSuffix": "visit-the-store", "created": true, "liveTemplateAdded": true }
}
```

Report:

- pages created, pages assigned a template, pages left as they were;
- our templates renamed (old → new);
- templates added to the live theme;
- pages without a template of ours yet (`figma-to-theme` builds them under the
  saved name);
- **Merchant to-do**: add content to each new page, which are published and empty.

Then continue with `shopify-menus`.
