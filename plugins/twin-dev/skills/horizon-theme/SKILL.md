---
name: horizon-theme
description: Conventions for editing Shopify Horizon-based themes (sections, blocks, snippets, schemas, settings, locales, {% stylesheet %} ownership, Component JS, section rendering). Use whenever creating or changing Liquid, schema JSON, theme CSS or theme JavaScript in a Horizon theme.
---

# Horizon theme conventions

Apply these rules whenever you edit a Shopify theme built on Horizon (Horizon, or a
theme derived from it). If the theme root has its own `AGENTS.md` or `CLAUDE.md`,
that file wins where it differs from this skill.

The full authoring guide is in [references/authoring-guide.md](references/authoring-guide.md).
Read the relevant section of it before non-trivial work on schemas, CSS delivery,
JavaScript components or section rendering.

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
  `grep -n -A5 "· horizon-theme ·" ~/.claude/twin-dev/failures.md` (no output or no
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
- Never write secrets (see **Secrets**) or customer data into the log.

Entry format (newest at the bottom):

```markdown
## YYYY-MM-DD · horizon-theme · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

Gap entry:

```markdown
## YYYY-MM-DD · horizon-theme · gap · <store>.myshopify.com (or "no store")
- **Missing:** what the instructions didn't cover
- **Did:** what you did, or what the user said to do
```

## Shopify docs

The plugin starts Shopify's Dev MCP server (`shopify-dev-mcp`). When you're
unsure of a Liquid tag or filter, a schema setting type, an Admin GraphQL field
or a theme feature, search its docs instead of working from memory:

- `learn_shopify_api` first when a tool asks for it (it returns the context the
  other tools need), then `search_docs_chunks` for docs and examples.
- `validate_theme` on Liquid and theme JSON you write or port.
- `validate` on Admin GraphQL operations (menus, pages, files).

Tool names can change between versions; if these are gone, use the ones it
lists. If it isn't connected, fall back to shopify.dev and say so.

## Stay close to the base theme

The base theme (Capital Commerce's Horizon build) will release new versions,
and every store project must be able to take them with little or no conflict.
So every change is judged by one question: **would this still merge cleanly
when the base updates?** Customise as little as the design needs.

- **Reach for the smallest change first.** In this order: existing global,
  section and block settings; blocks composed from existing ones; Custom CSS
  (section/block or global); a new `cc-` file; and only then anything bigger.
  Stop at the first one that does the job.
- **Additive only.** Add new files (`cc-` prefix), new settings, new blocks and
  new template content. Never edit, rename, reorder, reformat or delete a stock
  file, a stock setting, preset, default or template section ID. No formatting-
  only or "cleanup" edits to stock files, even harmless ones: they create
  merge conflicts for nothing.
- **Extend, don't fork.** To add behaviour to a stock section, add a `cc-`
  block it can hold (or use an existing block) instead of copying the stock
  section into a `cc-` copy. A copy stops receiving the base's fixes and
  features. Copy a stock file only when no block or setting can do it, and then
  put the base version and source file in a comment at the top so a later
  update can be compared.
- **Keep Custom CSS small and safe to upgrade.** Target the element's own
  classes, not deep chains through the stock markup (`div > div > span`); use
  the base's CSS variables where they exist; no `!important` unless a stock
  inline style forces it; one rule per design value, commented. Deep selectors
  and `!important` break when the base changes its markup.
- **Don't touch what a setting already owns.** Don't override in CSS or JS
  something a theme setting controls: the base can change how that setting
  renders, and your override would fight it.
- **Keep a deviation list.** `figma-build.md` records every place the project
  differs from the base: new `cc-` files, Custom CSS rules, copied stock files,
  and settings changed outside the token sheet. The person upgrading uses it
  to re-check each one after an update.
- **When unsure, ask which is smaller.** If two ways reach the design, take the
  one that touches fewer files and leaves the base's own code untouched.

## Before you edit

1. Identify the Horizon version (`config/settings_schema.json` → `theme_info`).
   4.x uses `color_palette` + `palette_*` role settings; older versions use
   `color_schemes`. Don't mix the two.
2. Search for an existing section, block, snippet, setting or CSS utility that
   already owns the behaviour. Extend it instead of adding a new one. Before a
   new `cc-` section or block, also search past stores with the
   `section-library` skill.
3. Read every file involved: the Liquid file, its schema, the snippets it renders,
   locale keys it uses, and the JS module that drives it.
4. Check whether a `schemas/` source folder exists. If it does, edit the source and
   regenerate; otherwise edit the embedded `{% schema %}` JSON directly.

## Where things go

| Need | Put it in |
|---|---|
| Merchant-addable page region | `sections/` |
| Nestable, selectable piece | `blocks/` (`_name.liquid` = internal block) |
| Reusable markup, no settings | `snippets/` via `{% render %}` with every local passed explicitly |
| Shop-wide choice | `config/settings_schema.json` |
| Storefront UI text | `locales/en.default.json` + `t` filter |
| Schema labels/help | `locales/en.default.schema.json` + `t:` keys |
| Merchant-owned copy/media/links | settings, blocks, resources or metafields, never hardcoded |
| Static component CSS | the owner file's single `{% stylesheet %}` tag |
| Styling for one stock section or block instance that no setting reaches | that instance's Custom CSS (`custom_css` in its template or group JSON), not the stock file |
| Same styling shared across a stock component site-wide | the theme's global Custom CSS (`current.custom_css` in `config/settings_data.json`, append only) |
| Per-instance values | inline custom properties or a scoped `{% style %}` |
| Custom styling in a store project that doesn't belong to a `cc-` component | global Custom CSS (site-wide) or the section's or block's own Custom CSS (small one-off), never a utility snippet such as `cc-fonts.liquid` (`@font-face` only), `layout/theme.liquid` or a new catch-all CSS file |

## Rules that are easy to break

- **Never rename or remove** existing setting IDs, block types, static block IDs,
  option values or template section IDs. Saved merchant data depends on them.
- Include `{{ block.shopify_attributes }}` on the wrapper of every selectable block.
- Render `{% content_for 'blocks' %}` once per file; capture it if two branches need it.
- Static blocks: `{% content_for 'block', type: '...', id: '...' %}`. Keep `type`/`id`
  stable and aligned with presets (`static: true`).
- Keep presets, `block_order` and nested block settings consistent with the schema.
- Escape plain merchant strings (`| escape`); leave rich text unescaped.
- Generated IDs must include `section.id` or `block.id` so they stay unique.
- Colours: use complete tokens (`var(--color-foreground)`). For alpha use
  `rgb(var(--color-foreground-rgb) / var(--opacity-70))`. For scoped overrides reuse
  `snippets/contrast-override.liquid`.
- CSS: BEM-ish low-specificity classes, logical properties (`margin-inline`),
  `min-width: 0` on flex/grid children, animate only `transform`/`opacity`, respect
  `prefers-reduced-motion`.
- Keep shared style-owner renders (`product-card-styles`, `add-to-cart-button-styles`,
  `quantity-selector-styles`, `variant-picker-styles`, etc.) when reusing markup.
- Product forms: preserve variant IDs, availability, quantity rules, accelerated
  checkout and submit semantics.

## JavaScript

- Use `Component` from `@theme/component` for interactive components.
- Call `super.connectedCallback()`, `super.updatedCallback()` and
  `super.disconnectedCallback()` when overriding them; clean up listeners, timers,
  observers and requests (prefer `AbortController`).
- Refs: `ref="name"` / `ref="name[]"`, typed with JSDoc. Treat conditional refs as
  optional. Events: `on:click="/handleClick"`.
- New modules: add an import-map entry in `snippets/scripts.liquid` if imported via
  `@theme/*`, and load them only where their markup renders.
- Section updates: `sectionRenderer` / `morphSection` from `@theme/section-renderer`;
  await them and handle rejections. Use `hydrate()` only for non-critical work.
- Don't add runtime dependencies.

## Images and performance

- `image_url` + `image_tag` with `width`, `height`, `widths` and a `sizes` that
  matches the real layout.
- Lazy-load below the fold; eager + `fetchpriority="high"` only for the verified
  first visible image.

## Accessibility

Semantic HTML first; every control has a name; decorative SVGs get
`aria-hidden="true"`; visible focus; Escape closes overlays and focus returns;
one live region per independently updated status; check RTL and zoom.

## Before you finish

1. Re-read changed Liquid, schema, locale, CSS and JS together and check that IDs,
   settings, refs, selectors and events agree.
2. Validate any JSON you touched (schema blocks, templates, locales).
3. Run `shopify theme check` and fix valid findings. Run the Dev MCP `validate_theme` tool on
   the changed files too, if it's connected.
4. Tell the user which templates to preview and any check you could not run.
