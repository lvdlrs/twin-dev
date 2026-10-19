---
name: shopify-menus
description: Create, update, back up and restore navigation menus (Online Store > Navigation) in a Shopify store's admin through the Admin GraphQL API (Shopify CLI `store execute`). Use when the user asks to add, build, change, copy or import a header, footer, mega or mobile menu, or to set up navigation from a sitemap, Figma design or existing site.
argument-hint: "[list | create | update | backup | restore] [--store <store>.myshopify.com]"
---

# Shopify menus

You're a Shopify Theme Developer setting up the store's navigation: you create,
update, back up and restore menus in the Shopify admin so the theme's header,
footer and mobile menus have the right links.

Manage navigation menus in the Shopify admin through the Admin GraphQL API.
Queries, mutations, item types and ID lookups are in
[references/menu-graphql.md](references/menu-graphql.md). Read it before writing a
request.

Put query and variables files in your scratchpad or a temp directory, never in the
theme folder.

## Failure log

Every twin-dev skill and agent records its failures in one shared file,
`~/.claude/twin-dev/failures.md` (all stores, all runs).

- **Before you start**, read your past entries and use the fixes recorded there
  instead of repeating an approach that already failed:
  `grep -n -A5 "· shopify-menus ·" ~/.claude/twin-dev/failures.md` (no output or no
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
## YYYY-MM-DD · shopify-menus · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

Gap entry:

```markdown
## YYYY-MM-DD · shopify-menus · gap · <store>.myshopify.com (or "no store")
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

## 0. Access

Use `store` from `.twin-dev.json` and confirm it with the user before the first
change. If you're not in a project folder or it's missing, ask for the
`<store>.myshopify.com` domain. Never guess it.

### Default: Shopify CLI store commands

Check `shopify version` and that `shopify store execute --help` works. If the
command doesn't exist, tell the user to update Shopify CLI, or use the fallback
below.

Authenticate once per store. The CLI opens a login, so ask the user to run it
in their own terminal if it needs a browser:

```bash
shopify store auth --store <store>.myshopify.com --scopes read_online_store_navigation,write_online_store_navigation,read_products,read_content,read_legal_policies
```

Drop `read_products` / `read_content` if the menu doesn't link to products,
collections, pages, blogs or articles. Drop `read_legal_policies` if the menu has
no Shipping, Returns/Refund, Privacy or other policy items. Re-run `store auth` if a command fails
because the token is missing, expired or lacks a scope.

Run requests:

```bash
# read
shopify store execute --store <store>.myshopify.com --query-file <file.graphql> [--variable-file <vars.json>] --json
# write (only after the user confirms the plan, section 2)
shopify store execute --store <store>.myshopify.com --query-file <file.graphql> --variable-file <vars.json> --allow-mutations --json
```

Never add `--allow-mutations` to a read. Add `--version <yyyy-mm>` only if the
store needs a specific API version; the default is the latest stable one.
Check `userErrors` in every mutation response; the command can succeed while
Shopify rejects the input.

### Validate first (optional)

If the Shopify Dev MCP tools are available (`@shopify/dev-mcp`), validate each
query and mutation against the Admin schema before running it. It never touches
the store.

### Fallback: token script

If `store execute` isn't available, use the bundled script:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/shopify-menus/scripts/admin-graphql.mjs" <query.graphql> [variables.json]
```

It needs `SHOPIFY_STORE` and either `SHOPIFY_ADMIN_TOKEN` (`shpat_...` from an
existing custom app) or `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET` (a Dev
Dashboard app installed on a store in the same organization), with the scopes
above. It exits non-zero on `userErrors`.

- If the variables aren't set, tell the user which ones to set in their own
  terminal. Don't ask them to paste a token or secret into the chat, and never
  write one into a file or command.
- If there's no access at all, use section 6.

## 1. Read what's there

Run the **List menus** query. Report each menu's title, handle, whether it's a
default menu, and its item tree (indent levels).

Save the full response as a backup before any change, e.g.
`menus-backup-<store>-<yyyy-mm-dd>.json` in the scratchpad, and tell the user the
path.

## 2. Plan the menu

Work out the item tree from what the user gave: a list, a sitemap, the current site,
a Figma frame (use the Figma MCP tools to read the nav), or another menu.

1. Resolve every link to a type and target. Prefer resource types (`COLLECTION`,
   `PAGE`, `PRODUCT`, `BLOG`, ...) over `HTTP` so links survive handle changes.
   Use `HTTP` only for external links, anchors and paths with no resource.
2. For pages, run the `shopify-pages` skill first, so the pages the menu links
   to exist. Use the page IDs saved in `.twin-dev.json` under `pages`, keyed by
   handle; look up anything else by handle.
   Look up resource IDs by handle with the queries in the reference. When a
   collection, page, product or blog doesn't exist yet, keep the item and link it
   to `#` (`{ "type": "HTTP", "url": "#" }`). Mark it in the plan so the merchant
   knows to relink it later. Don't invent IDs, and don't create products,
   collections or pages unless the user asks.
3. Policy items (Shipping, Returns / Refunds, Privacy, Terms, Contact info) link
   to the store's policies (Settings > Policies), not to pages. Run the **Look up
   policies** query in the reference and match by item label:

   | Item label (any wording) | Policy `type` |
   |---|---|
   | Shipping, Delivery | `SHIPPING_POLICY` |
   | Returns, Refunds, Exchanges | `REFUND_POLICY` |
   | Privacy | `PRIVACY_POLICY` |
   | Terms, Terms of Service | `TERMS_OF_SERVICE` |
   | Contact information | `CONTACT_INFORMATION` |

   - Policy exists (returned with a non-empty `body`): link it as
     `{ "type": "SHOP_POLICY", "resourceId": "<ShopPolicy id>" }`.
   - Policy missing or its `body` is empty: link it to `#`
     (`{ "type": "HTTP", "url": "#" }`) and mark it in the plan as "add the
     policy in Settings > Policies, then relink".
   - Don't fall back to a page with a similar name, and don't write policy text.
4. Keep to three levels (top, child, grandchild). Check the theme can show the
   depth you plan: in Horizon, the header menu block's settings and the mega menu
   layout decide how deep levels render.
5. Choose create vs update:
   - New menu: title it `Momentum - <Menu name>`, using the menu's name from the
     design or the user (`Momentum - Main Menu`, `Momentum - Footer Shop`). The
     handle is the title in lowercase with hyphens (`momentum-main-menu`). If
     that handle is taken, tell the user instead of picking another one.
   - Existing menu: build the **full** tree, reusing each kept item's `id`.
     `menuUpdate` deletes every item you leave out.

Show the plan as an indented tree with each item's type and target, plus:
the store, menu handle, create or update, items added / changed / removed, and any
missing resources. Get an explicit "yes" before writing.

## 3. Write

Run `menuCreate` or `menuUpdate` with the confirmed plan. If the response has
`userErrors`, read them, fix the input, and show the user what changed before
retrying.

Don't delete menus unless the user asks for that menu by name. Default menus
(`main-menu`, `footer`) can't be deleted or renamed by handle.

## 4. Connect it to the theme

A new menu does nothing until a section points to it. Find where the theme picks
its menus (header menu block, footer menu blocks, drawer / mobile menu) in
`sections/header-group.json`, `sections/footer-group.json` or the relevant
template, and the `link_list` setting IDs in those schemas.

- To switch the live theme's menu, tell the user where to choose it in the theme
  editor. Changing `*-group.json` locally and pushing it overwrites merchant
  settings; if the user wants it done in code, follow `/twin-dev:shopify-theme-deploy`.
- In Liquid, menus are read with `linklists['<handle>']` or a `link_list` setting.

### Mobile quick links

A single row of short links to collections or pages directly under the header
is a quick links menu, not part of the main menu. It can be text, pills or
buttons, and is usually only in the mobile frame (for example
`NEW · DRESSES · TOPS · SALE`). Each store styles it differently, so take the
look from this store's frame:

1. Create a menu titled `Momentum - Mobile Quick Links`
   (`momentum-mobile-quick-links`) with those links, in the same order, linked
   to their collections or pages (`#` when missing).
2. Add the `cc-header-quick-links` section to `sections/header-group.json` right
   after the header section, and set:
   - `menu`: `momentum-mobile-quick-links`;
   - `show_on_mobile` / `show_on_desktop`: on for each viewport whose frame
     shows the row (usually mobile only);
   - `layout_type`: `carousel` (always, so the row scrolls sideways when the
     links don't fit);
   - `link_style`: `text`, or `button` for pills and buttons (with their
     colours, border, radius and padding); `icons_style`: `none` unless the
     design shows arrows;
   - `columns_gap` from the gap between the links, and the font, size, weight,
     letter spacing, case and colour from the frame's text.

## 5. Report

- store and menu (title, handle, ID), created or updated;
- the final item tree as Shopify returned it;
- backup file path;
- items linked to `#` (missing resources) and what each should link to later,
  listing missing policies separately ("add in Settings > Policies");
- other items left as `HTTP` and why;
- what's left to do in the theme editor.

## 6. Without API access

If the user can't authenticate, produce the menu plan from section 2 as an
indented list with each item's title and link target, ready to enter in
**Online Store > Navigation**, and stop. If a browser tool is connected and the
user asks for it, you may enter the menu in the admin through the browser instead,
after the same confirmation.

## Restore

To roll back, read the backup JSON, convert its tree to `menuUpdate` input (keep
`title`, `type`, `url`, `resourceId`, `tags`, nested `items`; drop item `id`s that
no longer exist), show the diff against the current menu, and confirm before
writing.
