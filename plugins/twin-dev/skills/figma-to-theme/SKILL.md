---
name: figma-to-theme
description: Extract layouts, brand colours, typography and spacing from a Figma file and apply them to a Shopify Horizon theme through its existing settings, sections and blocks. Use when the user shares a figma.com link or asks to match a theme to a Figma design, brand guide or style tokens.
---

# Figma to Shopify theme

Turn a Figma design into theme changes. Work through the theme's existing settings
and components first; only write new code for what the settings can't express.

Requires the Figma MCP server (`mcp__figma__*` tools). If they aren't available, tell
the user to connect Figma and stop.

## 1. Read the design

For the link the user gave:

1. `get_metadata` on the file or page to list the frames (Desktop / Mobile / pages /
   components / style guide).
2. `get_variable_defs` on the style-guide frame (or the main page frame) to collect
   colour, typography, spacing and radius variables.
3. `get_screenshot` of each page frame so you can see the layout.
4. `get_design_context` on each frame or section you'll build, one at a time. Don't
   pull a whole page at once if it's large.

If the file has no variables or styles, read colours and fonts from the design
context and say they were inferred.

## 2. Build a token sheet

Show the user a table before changing anything:

| Token | Figma value | Theme target |
|---|---|---|
| Background | `#F7F3EE` | `color_palette` + `page_background_color` |
| Text | `#1A1A1A` | `page_text_color` |
| Primary button | `#1A1A1A` / `#FFFFFF` | `palette_primary_button_background` / `_text` |
| Heading font | Playfair Display 400 | `type_heading_font` |
| H1 size | 56 / 36 px | `type_size_h1` / `type_size_h1_mobile` |
| Button radius | 0 | `button_border_radius_primary` |
| Page width | 1440 | `page_width` |

How to find the targets:

- Read `config/settings_schema.json` for the real setting IDs, types, ranges and
  options. Values must fit the setting's `min`/`max`/`step` and option list.
- **Horizon 4.x**: colours live in the `color_palette` setting plus role settings
  (`palette_*`, `page_background_color`, `page_text_color`, badge/drawer/popover
  colours). Role settings usually reference palette colours, so add brand colours
  to the palette first, then assign roles.
- **Older Horizon**: colours live in `color_schemes`. Map brand colours to schemes
  (background, foreground, primary button, etc.).
- Fonts: font settings take Shopify font-library handles (for example
  `playfair_display_n4`). If the brand font isn't in the library, say so, suggest
  the closest library font, and only add a custom `@font-face` if the user agrees
  and supplies the licensed files.
- Check contrast for every text/background and button pair (4.5:1 body text, 3:1
  large text and UI). Flag failing pairs from the design rather than silently
  changing them.

## 3. Apply global settings

After the user approves the token sheet:

- Edit the `current` object in `config/settings_data.json`. Change only the keys in
  the sheet and keep all other values.
- Don't edit `config/settings_schema.json` defaults unless the user asks for it.
- Validate the JSON after editing.

## 4. Map the layout to sections

For each Figma page, list its sections from top to bottom and match each one to an
existing section + blocks:

| Figma section | Theme section / blocks | Gaps |
|---|---|---|
| Hero with heading + 2 buttons | `hero` → `text`, `button` ×2 | none |
| 3-column USP row | `section` → `group` ×3 → `icon`, `text` | icon set differs |

- Prefer building the layout in `templates/*.json` with existing sections and blocks
  and their settings (spacing, alignment, colour, width).
- Only create a new section, block, snippet or asset when no existing one can do
  it. Name it with a `cc-` prefix (`sections/cc-feature-banner.liquid`) and follow
  the `horizon-theme` skill when you do.
- Keep section IDs in templates stable when editing an existing template.
- Links (buttons, cards, images, text links): point them at the real resource
  (`shopify://collections/<handle>`, `shopify://pages/<handle>`, ...) when it
  exists in the store. When it doesn't exist yet, or you can't check the store, set
  the link to `#` and list it in the report so the merchant can relink it later.
  Never invent a handle.
- Mobile: compare the mobile frame and use the mobile-specific settings
  (`*_mobile`) where they exist.

## 5. Menus

Read every menu in the design: header nav, mega menu, mobile drawer, footer
columns, and utility or legal links. Create each one in the Shopify admin with the
`shopify-menus` skill. That skill names them `Momentum - <Menu name>` and links
missing pages to `#`. Then point the header and footer menu settings at the new
menus as that skill's step 4 describes.

## 6. Assets

- Use `download_assets` for images and icons the theme needs.
- Product and content photos belong in Shopify Files or on resources, not in
  `assets/`. Tell the user which images to upload and where they're used.
- SVG icons that become part of the theme UI can go in `assets/` or a snippet.
  Mark them `aria-hidden="true"` when decorative.

## 7. Report

Finish with:

- the token sheet as applied;
- the section mapping, with what you built and what still needs the merchant
  (images, copy, links, products);
- menus created, and every menu item or section link set to `#`, with what it
  should link to;
- design details the theme can't reproduce without custom code;
- contrast failures found in the design.
