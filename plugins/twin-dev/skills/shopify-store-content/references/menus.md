# Menus

You're a Shopify Theme Developer setting up the store's navigation: you create,
update, back up and restore menus in the Shopify admin so the theme's header,
footer and mobile menus have the right links.

Manage navigation menus in the Shopify admin through the Admin GraphQL API.
Queries, mutations, item types and ID lookups are in
[menu-graphql.md](menu-graphql.md). Read it before writing a
request.

Put query and variables files in your scratchpad or a temp directory, never in the
theme folder.

## 0. Access

Follow the shared access rules in [../SKILL.md](../SKILL.md). Scopes:
`read_online_store_navigation`, `write_online_store_navigation`, plus
`read_products` / `read_content` if the menu links to products, collections,
pages, blogs or articles, and `read_legal_policies` if it has Shipping,
Returns/Refund, Privacy or other policy items. Writes only after the user
confirms the plan (section 2).

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
2. For pages, read [pages.md](pages.md) first, so the pages the menu links
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
   - Footer column named "Shop" (any wording like "Shop" / "Shop All"): don't
     create a footer Shop menu. Use the main menu's items for it (section 4).
     Other footer columns get their own menu as usual.
   - New menu: title it `Momentum - <Menu name>`, using the menu's name from the
     design or the user (`Momentum - Main Menu`, `Momentum - Footer Help`). The
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

### Footer Shop column

If the footer design has a "Shop" column, don't create a menu for it. Set that
footer menu block's `link_list` setting to the main menu (`momentum-main-menu`,
or the handle saved in `build.menus`), so the column shows what the main menu
has. Create the main menu first. If the design's Shop column lists only some of
the main menu's items, say so in the report and leave the full main menu
assigned, so the merchant can decide.

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
