---
name: figma-to-theme
description: Extract layouts, brand colours, typography and spacing from a Figma file and apply them to a Shopify Horizon theme through its existing settings, sections and blocks. Use when the user shares a figma.com link or asks to match a theme to a Figma design, brand guide or style tokens.
---

# Figma to Shopify theme

Turn a Figma design into theme changes. Work through the theme's existing settings
and components first; only write new code for what the settings can't express.

Requires the Figma MCP server. Its tools are named `mcp__figma__*` or
`mcp__claude_ai_Figma__*` depending on how it's connected. If neither is
available, tell the user to connect Figma and stop. Load the `figma-design-to-code`
skill (or the `skill://figma/figma-design-to-code/SKILL.md` resource) before the
first `get_design_context` call, as the Figma server requires. Treat its output as
a reference: here the target is theme settings and existing blocks, not new
components.

## Failure log

Every twin-dev skill and agent records its failures in one shared file,
`~/.claude/twin-dev/failures.md` (all stores, all runs).

- **Before you start**, read your past entries and use the fixes recorded there
  instead of repeating an approach that already failed:
  `grep -n -A5 "· figma-to-theme ·" ~/.claude/twin-dev/failures.md` (no output or no
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
## YYYY-MM-DD · figma-to-theme · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

## 0. Open the file

- Use the Figma link the user gave. If they gave none, use `figmaUrl` from the
  project's `.twin-dev.json`; if that's empty too, ask for this store's link. Save
  the link as `figmaUrl` in `.twin-dev.json` (ask first if it replaces a different
  one), so `qa-checker` and later sessions use the same file.
- Parse the link: `figma.com/design/<fileKey>/<name>?node-id=<a>-<b>` → `fileKey`,
  `nodeId` `a:b`. `node-id=0-1` is a whole canvas page, not a frame. `m=dev` (Dev
  Mode) and `p=f` don't matter. For `/design/<fileKey>/branch/<branchKey>/`, use
  `branchKey`.
- Call `get_metadata` with only `fileKey` first to list the canvas pages.
- **"You don't have edit access to this file"** means the Figma account connected
  to the MCP server can't read the file. It isn't a rate limit, so don't retry.
  Stop and ask the user to either share the file with that account as an editor,
  or duplicate it into a team where that account is an editor and send the new
  link. Don't rebuild the design from public screenshots or guesses.
- A rate-limit error: wait, then fetch fewer, smaller nodes.

## 1. Read the design

1. **Inventory.** `get_metadata` on each canvas page. Build a page × viewport table
   before anything else and show it to the user:

   | Page | Desktop frame (width) | Mobile frame (width) | Notes |
   |---|---|---|---|
   | Home | `12:34` (1440) | `56:78` (390), hero and menu only | |
   | Product | `90:12` (1440) | — | |
   | Style guide | `3:4` | | colours, type, buttons |
   | Components / states | `7:8` | | hover, cart drawer, mega menu |

   Mobile designs are often partial (a few sections, or only header and menu).
   Record exactly which sections have a mobile frame; the build and `qa-checker`
   both depend on it. Also look for frames that show states rather than pages:
   hover, open mega menu, mobile drawer, cart drawer, search overlay, empty cart,
   sold out, form errors.
2. **Tokens.** `get_variable_defs` on the style-guide frame and on one desktop
   page frame. It returns the variables and styles the nodes use, so a page frame
   catches tokens the style guide misses. Collect colours, text styles (family,
   weight, size, line height, letter spacing, case), spacing, radius and shadows.
3. **Screenshots.** `get_screenshot` of each page frame (raise `maxDimension` to
   ~2000 for long pages, or screenshot sections separately) so you see the layout.
4. **Details.** `get_design_context` on each section you'll build, one at a time.
   If it returns only metadata because the node is too big, call it on the child
   section nodes instead. Don't pull a whole page at once.

If the file has no variables or styles, read colours and fonts from the design
context and say they were inferred. Count the distinct text styles the pages
actually use; designers often have more than the theme's six heading slots (see
the typography note in step 2).

Ignore hidden layers, frames named like `old`, `v1`, `archive`, `wip` or
`unused`, and anything outside page frames, unless the user says otherwise. If
two frames look like versions of the same page, ask which one is final.

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
- **Desktop and mobile values.** The base theme scales every desktop/mobile pair
  (type sizes, gaps, custom widths, spacers) linearly from the mobile value at
  375px to the desktop value at 1440px (`snippets/cc-fluid-value.liquid`). Take
  desktop values from the 1440 frame and mobile values from the mobile frame (a
  375 or 390 frame both work). If the desktop frame isn't 1440 wide (1280, 1920),
  scale values to 1440 or ask. If there's no mobile frame for a token, leave
  the mobile setting at the theme value and say so; don't invent a smaller size.
- **More text styles than slots.** Map the most used styles to H1–H6 and
  paragraph by size, not by the layer name ("Heading/XL" might be the theme's
  H2). List the rest and set them per block with the `text` block's
  `type_preset: custom` (font, weight, size, line height, letter spacing, case).
  If one extra style repeats across many sections, ask whether it should take a
  heading slot instead.
- **Shadows** only exist for popovers (`popover_drop_shadow`) and layered
  slides. List any other designed shadow as a difference.
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

### Read this store's theme

Every store's theme ends up with different sections, blocks and layouts, so
don't work from memory or from another project. From the project folder, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/figma-to-theme/scripts/theme-inventory.mjs" --theme .
```

It reads the theme's own files and prints:

- every section with its presets, allowed blocks and whether it's limited to the
  header or footer group;
- every theme block with the child blocks it accepts (`_` blocks are internal and
  only work where a parent lists them);
- what each template and section group holds now, section by section, with
  block trees.

Custom `cc-` files are marked ★. Before you set a section or block's values, get
its settings with `--detail <type>[,<type>]` (types, ranges, options, defaults,
preset block trees). Add `--settings` to list setting IDs for everything.
Re-run it after you add a `cc-` file. If what you remember about the theme
disagrees with the script's output, go with the script.

### Order

Work through the Figma pages one at a time, in this order: header and footer,
home, product, collection, then content pages. Header, footer and the product
card appear on every page, so match them first.

Keep a build log at `figma-build.md` in the project root: the inventory table,
then one row per page with its status (`todo`, `building`, `built`, `QA later`),
template, Figma frame and open questions. Update it after each page, so the work
can continue in a later session. Shopify CLI doesn't upload root files, so it
stays local.

### Header, footer and global components

- Header and footer live in `sections/header-group.json` and
  `sections/footer-group.json`, not in templates. The inventory shows which
  sections each group holds and which sections can only go in a group (in the
  base theme: announcement bar, header, quick links, footer, copyright row).
  Match logo position, menu row, search, sticky and icon vs text actions in the
  header settings.
- Product card: find the card in the design and set up the product card block
  and its children (gallery, title, price, swatches, quick shop) once. Then reuse
  that setup in every section that shows cards; the inventory's block trees show
  which ones do.
- Drawers, popovers and the cart drawer take their colours from the global
  settings in step 3. Check any state frames (cart drawer, mega menu, mobile
  menu) against them.

### Skip pages that already match

Before building a page, check whether the downloaded theme already matches it:

1. Find the page's template (`templates/index.json`, `templates/product.json`, ...)
   in the inventory's "Current layouts" and read its sections and blocks in order.
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
section + blocks from the inventory. Look at the presets first: a section's
presets (for example "Image with text", "FAQ", "Products carousel") are often an
exact match for a Figma section. Write the mapping out like this:

| Figma section | Theme section / blocks | Gaps |
|---|---|---|
| Hero with heading + 2 buttons | `hero` → `text`, `button` ×2 | none |
| 3-column USP row | `section` → `cc-icon-text-list` → `_cc-icon-text-item` ×3 | icon set differs |

- Prefer building the layout in `templates/*.json` with existing sections and blocks
  and their settings (spacing, alignment, colour, width). Copy the block structure
  of the matching preset from the section's schema, then change settings.
- Translate Figma auto layout directly: direction → `content_direction`, gap →
  `gap` / `gap_mobile`, padding → `padding-block-*` / `padding-inline-*`,
  alignment → `horizontal_alignment` / `vertical_alignment`, fill/hug/fixed width →
  group `width` `fill` / `fit-content` / `custom` %. Section padding is 0–100px and
  has no mobile value: use the desktop value and list sections whose mobile
  padding differs a lot.
- Content edge to edge → `section_width: full-width`; content inside the page
  grid → `page-width`.
- Copy: use the real text from the design in block settings. If the design uses
  lorem ipsum or obvious placeholder copy, keep the theme's default text and list
  the section under "copy needed".
- Text styles: use `type_preset` `h1`–`h6` / `paragraph` when the style matches a
  global token; `custom` only for the extra styles listed in step 2.
- Buttons: `style_class` `button` / `button-secondary` when they match the global
  button tokens; `button-custom` only for one-off buttons.
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
  (`*_mobile`, `vertical_on_mobile`, `mobile_columns`, `carousel_on_mobile`,
  `mobile_image`, group `mobile_order`, `show_on_desktop` / `show_on_mobile`)
  where they exist. For sections without a mobile frame, follow the patterns of
  the mobile frames that do exist (side padding, how cards stack, heading sizes),
  and list those sections in the build log as "mobile inferred".
- Validate each template JSON after editing (strip the leading `/* */` comment
  first, as with `settings_data.json`). Check that every block `type` is allowed
  by its parent's schema, and that `block_order` lists every block.

### Check the page

When the page is built, check it before moving on:

1. If the project has a theme ID (`themeId` in `.twin-dev.json`), push the changed files to
   it as the `shopify-theme-deploy` skill describes. Otherwise run
   `shopify theme dev` and use the local preview URL.
2. With a browser tool, screenshot the page at 1440px and 390px and compare it
   section by section with the Figma screenshots: order, spacing, sizes, colours,
   alignment, image crops.
3. Fix what's fixable with settings and check again. Stop after three rounds on
   one page and list what's left.

Without a browser tool, say so, mark the page `built` (not checked) in the build
log, and leave the comparison to the `qa-checker` agent.

## 5. Menus

Read every menu in the design: header nav, mega menu, mobile drawer, footer
columns, and utility or legal links. Create each one in the Shopify admin with the
`shopify-menus` skill. That skill names them `Momentum - <Menu name>` and links
missing pages to `#`. Then point the header and footer menu settings at the new
menus as that skill's step 4 describes.

## 6. Assets

- Use `download_assets` for images and icons the theme needs. Save them in a
  folder outside the theme (the scratchpad, or `figma-assets/` in the project
  root, which Shopify CLI doesn't upload), named after the section they belong
  to: `home-hero-desktop.jpg`, `home-hero-mobile.jpg`.
- Product and content photos belong in Shopify Files or on resources, not in
  `assets/`. Once a file is in Shopify Files, reference it in template JSON as
  `"image": "shopify://shop_images/<filename>"`. Until then, leave the image
  setting empty (the theme shows a placeholder) and list the file, its section
  and setting so the merchant or developer can upload it.
- Export photos at 2× their largest displayed size, as JPG or WebP. Logos and
  icons should be SVG.
- Logo and favicon are global settings (`logo`, `logo_inverse`, `favicon`) and
  need uploading the same way.
- Before adding an icon, check the built-in icon set (the `icon` and `button`
  blocks' `icon` options, such as `truck`, `return`, `lock`). Only add a custom SVG
  when none fits; theme UI icons can go in `assets/cc-icon-*.svg` or a `cc-`
  snippet. Mark them `aria-hidden="true"` when decorative.

## 7. Report

Finish with:

- the token sheet as applied, with clamped, rounded and unsupported values;
- the section mapping, with what you built and what still needs the merchant
  (images, copy, links, products);
- sections whose mobile layout was inferred because there's no mobile frame,
  for the client to confirm;
- images to upload, each with its file name, section and setting;
- the **QA later** list: pages skipped because the theme already matched, each
  with its template, Figma frame and how it was checked. Pass this list to the
  `qa-checker` agent (it reads the store, theme and Figma link from
  `.twin-dev.json`) so it checks those pages 1:1;
- menus created, and every menu item or section link set to `#`, with what it
  should link to;
- design details the theme can't reproduce without custom code;
- contrast failures found in the design.
