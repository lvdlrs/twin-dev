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

The base theme is Capital Commerce's Horizon build
([lvdlrs/capital-horizon-theme](https://github.com/lvdlrs/capital-horizon-theme),
Horizon 4.2.0 with `cc-` customisations). The targets below are its real setting
IDs. Check `config/settings_schema.json` in the project anyway: a newer base may
add or rename settings, and values must fit each setting's `min`/`max`/`step` and
option list.

Show the user the sheet, grouped as below, before changing anything. Fill in the
Figma value for every row the design defines and leave out rows it doesn't.

**Colours**

| Token | Figma value | Theme target |
|---|---|---|
| Brand colours | `#F7F3EE`, `#1A1A1A`, `#2B76B5` ... | `color_palette`: `background`, `foreground`, then `color1`, `color2` ... |
| Page background | | `page_background_color` |
| Body / heading text | | `page_text_color` |
| Primary button | bg / text / border, hover bg / text / border | `palette_primary_button_background`, `_text`, `_border`, `_hover_background`, `_hover_text`, `_hover_border` |
| Secondary button | same six | `palette_secondary_button_*` |
| Inputs | bg / text / border | `palette_input_background`, `_text`, `_border` |
| Variant pickers | default and selected bg / text / border | `palette_variant_*`, `palette_selected_variant_*` |
| Drawers | bg / text / border | `drawer_background_color`, `drawer_text_color`, `drawer_border_color` |
| Popovers / modals | bg / text / border / shadow | `popover_background_color`, `popover_text_color`, `popover_border_color`, `popover_shadow_color` |
| Badges | sale, sold out, style: bg / text | `badge_sale_*`, `badge_sold_out_*`, `badge_style_*` (`_background_color`, `_text_color`) |
| Quick add | bg / text | `quick_add_background`, `quick_add_text` |
| Free shipping bar | fill / track | `progress_bar` (gradient), `progress_bar_bg` |

**Typography**

| Token | Figma value | Theme target |
|---|---|---|
| Body font | | `type_body_font` |
| Subheading font | | `type_subheading_font` |
| Heading font | | `type_heading_font` |
| Accent font | | `type_accent_font` |
| Paragraph size desktop / mobile | 16 / 14 px | `type_size_paragraph`, `type_size_paragraph_mobile` |
| Paragraph line height | | `type_line_height_paragraph` |
| H1–H6 font | | `type_font_h1` ... `type_font_h6` |
| H1–H6 size desktop / mobile | 56 / 36 px | `type_size_h1`, `type_size_h1_mobile` ... |
| H1–H6 line height | | `type_line_height_h1` ... |
| H1–H6 letter spacing desktop / mobile | | `type_letter_spacing_h1_px`, `type_letter_spacing_h1_px_mobile` ... |
| H1–H6 case | | `type_case_h1` ... |
| Buttons (primary / secondary) | font, size desktop / mobile, weight, line height, letter spacing, case | `type_font_button_primary`, `type_size_button_primary(_mobile)`, `type_weight_button_primary`, `type_line_height_button_primary`, `type_letter_spacing_button_primary_px(_mobile)`, `button_text_case_primary` (same with `secondary`) |
| Badges | font, size, weight, letter spacing, case | `badge_font_family`, `badge_font_size`, `badge_font_weight`, `badge_letter_spacing(_mobile)`, `badge_text_transform` |
| Variant option name / value / button text | font, size, weight, letter spacing, case | `variant_option_name_*`, `variant_option_value_*`, `variant_button_text_*` |
| Card and cart text | title case, cart price font | `card_title_case`, `product_title_case`, `cart_price_font` |

**Shape and layout**

| Token | Figma value | Theme target |
|---|---|---|
| Page width | 1440 | `page_width` |
| Logo height desktop / mobile | | `logo_height`, `logo_height_mobile` |
| Button radius / border width | | `button_border_radius_primary`, `primary_button_border_width` (same with `secondary`) |
| Pill radius | | `pills_border_radius` |
| Input radius / border width | | `inputs_border_radius`, `input_border_width` |
| Popover radius / border width / shadow | | `popover_border_radius`, `popover_border_width`, `popover_drop_shadow` |
| Card and product image radius | | `card_corner_radius`, `product_corner_radius` |
| Badge radius / position | | `badge_corner_radius`, `badge_position` |
| Variant buttons | radius, border width, equal width | `variant_button_radius`, `variant_button_border_width`, `variant_button_width` |
| Swatches | width, height, radius, border | `variant_swatch_width`, `_height`, `_radius`, `_border_style`, `_border_width`, `_border_opacity` |
| Cart thumbnails | border, radius | `cart_thumbnail_border`, `_border_width`, `_border_opacity`, `_border_radius` |
| Icon stroke | | `icon_stroke` |

How to convert Figma values to this theme:

- **Colours**: `color_palette` holds `background`, `foreground` and numbered
  `color1`, `color2` ... keys. Add every brand colour there first, then point role
  settings at palette colours (`{{ settings.color_palette.color2 }}`) instead of
  pasting hex values, so changing the palette updates every role.
- **Fonts**: font settings take Shopify font-library handles with style and weight
  (`inter_n7`, `roboto_condensed_n4`). If the brand font isn't in the library, say
  so, suggest the closest library font, and only add a custom `@font-face` if the
  user agrees and supplies the licensed files. H1–H2 can only use `heading` or
  `accent`; H3–H6 can also use `subheading` or `body`.
- **Sizes** (`type_size_*`, `badge_font_size`, `variant_*_font_size`) are free
  numbers in px. Use the Figma value as is.
- **Line heights** are presets, not numbers. Pick the closest: headings
  `display-tight` 1.0, `display-normal` 1.1, `display-loose` 1.2; paragraph and
  buttons `body-tight` 1.2, `body-normal` 1.4, `body-loose` 1.6. Figma gives line
  height in px or %, so divide by the font size first, and list any value more
  than 0.1 away from a preset as a difference.
- **Letter spacing** is in px, 0–10 in 0.1 steps. Convert Figma % to px
  (`size × % / 100`). Negative tracking can't be set: use 0 and list it.
- **Weights**: button and badge weights are a select (100, 300, 400, 500, 600,
  700, 900; variant text 400–700). Round to the nearest option. Heading and body
  weights come from the font handle (`_n4`, `_n7`), not a separate setting.
- **Case**: Figma "Upper case" → `uppercase`. The "no change" value is `none` for
  headings, badges and variants, and `default` for buttons and card/cart titles.
- **Page width** is a select: `narrow` = 1440px (90rem), `normal` = 1920px
  (120rem), `wide` = 2400px (150rem). Pick the one matching the design's content
  width; a 1440 Figma frame is usually `narrow`.
- **Radii and border widths** are ranges with their own limits (button radius
  0–100, inputs 0–32, cards 0–16, popovers 0–16, button/input borders 0–4). Clamp
  to the range and list anything clamped.
- Check contrast for every text/background and button pair (4.5:1 body text, 3:1
  large text and UI). Flag failing pairs from the design rather than silently
  changing them.
- **Not the Capital Commerce base?** If the project's `settings_schema.json` has
  `color_schemes` instead of `color_palette`, it's an older Horizon: map brand
  colours to schemes (background, foreground, primary button, etc.) instead.

## 3. Apply global settings

After the user approves the token sheet:

- Edit the `current` object in `config/settings_data.json`. Change only the keys in
  the sheet and keep all other values. Leave the `presets` object (the "Capital
  Commerce" preset) alone unless the user asks to update it.
- The file starts with a `/* ... */` comment block. Keep it; strip it only in
  memory when parsing.
- Don't edit `config/settings_schema.json` defaults unless the user asks for it.
- Validate the JSON (after stripping the comment) after editing.

## 4. Map the layout to sections

Work through the Figma pages one at a time.

### Skip pages that already match

Before building a page, check whether the downloaded theme already matches it:

1. Find the page's template (`templates/index.json`, `templates/product.json`, ...)
   and list its sections and blocks in order.
2. Compare them with the Figma frame: same sections in the same order, same
   blocks and content, and layout settings (spacing, alignment, width, columns)
   that fit the design. Global tokens were already applied in step 3, so judge
   colours and fonts through those.
3. If a browser tool and a preview URL are available, screenshot the page at
   1440px and 390px and compare it with the desktop and mobile frames.

If the page matches, don't touch its template. Add it to the **QA later** list
with the template path, the Figma frame, and how you checked it (template only,
or template and screenshots), then move on to the next page. If anything differs,
or you can't tell, build the page as below.

### Build the page

List the page's sections from top to bottom and match each one to an existing
section + blocks:

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
- the **QA later** list: pages skipped because the theme already matched, each
  with its template, Figma frame and how it was checked. Pass this list to the
  `qa-checker` agent with the Figma link so it checks those pages 1:1;
- menus created, and every menu item or section link set to `#`, with what it
  should link to;
- design details the theme can't reproduce without custom code;
- contrast failures found in the design.
