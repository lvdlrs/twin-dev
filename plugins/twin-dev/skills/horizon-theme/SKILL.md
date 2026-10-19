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
- Never write passwords, tokens, API keys or customer data into the log.

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
| Per-instance values | inline custom properties or a scoped `{% style %}` |

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
