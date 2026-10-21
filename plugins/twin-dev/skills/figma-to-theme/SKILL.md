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
- A **gap** isn't an error: the instructions had no rule for something you
  met, so you worked it out or the user told you what to do. Log it as a gap
  entry (below), so `improve-skills` can turn it into a rule.
- Never write passwords, tokens, API keys or customer data into the log.

Entry format (newest at the bottom):

```markdown
## YYYY-MM-DD · figma-to-theme · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

Gap entry:

```markdown
## YYYY-MM-DD · figma-to-theme · gap · <store>.myshopify.com (or "no store")
- **Missing:** what the instructions didn't cover
- **Did:** what you did, or what the user said to do
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
3. **Screenshots.** The page frame's child nodes in `get_metadata` give the
   section order. Take one `get_screenshot` of a page frame, at the default
   size, only when that tree doesn't make the layout clear. Section images come
   with step 4.
4. **Details.** `get_design_context` on each section you'll build, one at a time,
   when you write its spec. If it returns only metadata because the node is too
   big, call it on the child section nodes instead. Don't pull a whole page at
   once. Follow **Keep the context small** in `references/design-match.md`:
   each Figma node is read once, and the spec in `figma-build.md` replaces it
   after that.

If the file has no variables or styles, read colours and fonts from the design
context and say they were inferred. Count the distinct text styles the pages
actually use; designers often have more than the theme's six heading slots (see
the typography note in step 2).

Ignore hidden layers, frames named like `old`, `v1`, `archive`, `wip` or
`unused`, and anything outside page frames, unless the user says otherwise. If
two frames look like versions of the same page, ask which one is final.

**Reading how the designer structured a frame.** Designs are often exported
from code or hand-edited, so the layer tree can mislead. Read it like this
before you write any section spec:

- **Layer names differ by page.** Some frames have generic auto names
  (`Container`, `Paragraph`, `Link`), others have meaningful ones (`Stock
  alert`, `Purchase benefits`, `Collection controls`, `Load more`). When a
  frame has meaningful names, use them to recognise the component (see
  **Recurring store components**); when it's generic, recognise it by what it
  does and where it sits.
- **Stray and duplicated layers.** Hand-edited frames keep leftovers: repeated
  groups of the same component (a "Purchase benefits" row three or four times
  at stacked y positions), zero-width or 1px frames, two same-named text
  layers at overlapping positions, loose vectors. Decide what's visible with
  one screenshot of that section, build only what's visible, and don't count
  the leftovers as extra elements.
- **Repeated rows are one grid.** Several identical rows of cards (two rows of
  four, each in its own wrapper) are one product grid with a row gap, not
  separate sections. Count the columns from the card widths.
- **Names don't always match behaviour.** A frame called `Load more` may hold
  numbered pagination ("1 2 3" with an arrow). Take the behaviour from what is
  drawn, not the name.
- **Overlap is a tab or toggle.** Two titles side by side with a line under one
  (`You may also like` / `Recently viewed`) are tabs; the underlined one is
  the active tab.
- **Collection and product frames are usually desktop only.** Check the mobile
  list from step 1 before you write mobile values for them.

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
  height in px or %, so divide by the font size first. For a value more than
  0.1 away from a preset, set the closest preset and fix the exact value with
  the fix ladder in `references/design-match.md` (step 4).
- **Letter spacing** is in px, 0–10 in 0.1 steps. Convert Figma % to px
  (`size × % / 100`). Negative tracking can't be set: use 0 and fix it with the
  fix ladder (a global value with no theme setting is a `manual` item).
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
  to the range, then fix the exact value with the fix ladder.
- **Desktop and mobile values.** The base theme scales every desktop/mobile pair
  (type sizes, gaps, custom widths, spacers) linearly from the mobile value at
  375px to the desktop value at 1440px (`snippets/cc-fluid-value.liquid`).
  **Figma is the source of truth: every setting holds the exact value Figma
  shows, never a back-solved or scaled number.** Put the desktop frame's value
  in the desktop setting and the mobile frame's value in the mobile setting
  (a 375 or 390 frame both work), whatever the desktop frame's width (1280,
  1359, 1920). Never compute a value so the fluid scale lands on the Figma
  number at the frame width: that gives fractions such as 12.2 or 15.3 in the
  editor that match nothing in the design. If a measurement at the frame width
  differs from Figma only because of the scale, it's not a mismatch (see
  `references/design-match.md` tolerance). If there's no mobile frame for a
  token, leave the mobile setting at the theme value and say so; don't invent
  a smaller size.
- **More text styles than slots.** Map the most used styles to H1–H6 and
  paragraph by size, not by the layer name ("Heading/XL" might be the theme's
  H2). List the rest and set them per block with the `text` block's
  `type_preset: custom` (font, weight, size, line height, letter spacing, case).
  If one extra style repeats across many sections, ask whether it should take a
  heading slot instead.
- **Shadows** only exist for popovers (`popover_drop_shadow`) and layered
  slides. Add any other designed shadow with the fix ladder.
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

Create the menus (step 5) before you build anything here, right after the
global settings, so the header and footer are matched with their real menus.

Then work through the Figma pages one at a time, in this order: header and
footer, home, collection, product, 404, search, Visit the Store, then the other
content pages. Build each page's sections one by one, desktop and then mobile.
Header, footer and the product card appear on every page, so match them first.
404, search and Visit the Store follow **Standard pages** when the design has
no frame for them.

Before building a new `cc-` section or block for a design component, search past
stores with the `section-library` skill and reuse or port the closest match. When
the page is built, record its `cc-` files there (`library.mjs add` and a `note`
per new or changed entry).

Content pages use the template names the `shopify-pages` skill chose, saved in
`.twin-dev.json` under `pages` (`templateSuffix: "about"` →
`templates/page.about.json`). Run that skill before building content pages, and
never create a page template under a different name.

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

### Recurring store components

Most store designs include the components below, but each store styles them
differently: other wording, icons, colours, layout, and boxed or plain.
Recognise them by **what they do and where they sit**, not by how one design
draws them or what its layers are called. The examples come from past
designs. Always take the styling from this store's frame (spec and fix ladder
in `references/design-match.md`). The rule here only decides which theme
component to use and how it behaves.

- **Quick links bar.** A single row of short links to collections or pages,
  directly under the header: text, pills or buttons (`NEW · DRESSES · TOPS ·
  SALE`). Usually only in the mobile frame.
  - Build it with the `cc-header-quick-links` section in the header group,
    right after the header, with its own `Momentum - Mobile Quick Links` menu
    (`shopify-menus`, "Mobile quick links").
  - `layout_type` is always `carousel`.
  - `show_on_mobile` / `show_on_desktop` follow the frames that show it.
  - `link_style` is `text` or `button`, to match the design.
- **Product purchase benefits (USPs).** Icon + short text rows near the buy
  buttons: stock, shipping, pickup, returns, guarantees. Examples: "In Stock,
  Ready To Ship", "Store Pickup Available", "Free returns".
  - Use the `product-usp` block with one `_product-usp-item` per row, in the
    design's order, not a new `cc-` block.
  - Set `columns` to match the layout (2 when rows sit side by side), each
    row's `text` from the design, and its `icon` from the block's icon list,
    or `image_upload` when none fits.
  - Only keep the preset's rows that the design shows, and skip rows in the
    frame that have an icon but no text.
  - A **stock row** (in stock, ready to ship, available now) always has
    `tie_to_inventory: true` and `set_threshold: false`. It then shows only
    while the selected variant is in stock and hides when it's sold out.
  - A **low-stock row** ("Only 3 left") is `tie_to_inventory: true`,
    `set_threshold: true` with the design's or the default threshold, and
    `||quantity||` in place of the number.
- **Stock alert.** A low-stock or urgency message on the product page
  ("Low in stock — only 4 left", "Selling fast"), plain or in a box. It always
  depends on the selected variant's inventory and shows only at or below a
  threshold.
  1. Look for a product block that already does it: this theme's blocks in
     the inventory (`_product-usp-item` with `tie_to_inventory` and
     `set_threshold`, `product-inventory`, any `cc-` stock block), then the
     `section-library`. Use it if its settings can produce the design (text,
     icon, colours, box, border, radius, padding). `product-inventory` always
     shows a status and uses fixed text, so it only fits a design that does the
     same.
  2. If none fits, create a `cc-` product block (for example
     `blocks/cc-stock-alert.liquid`) with the `horizon-theme` skill. It must:
     - be tied to inventory by default (`tie_to_inventory: true`), with an
       `inventory_threshold` setting (the design's number, else 10);
     - show only when the selected variant tracks inventory and its quantity
       is above 0 and at or below the threshold; hide it when the variant is
       sold out, above the threshold, or doesn't track inventory;
     - take its text from a setting with a `||quantity||` token for the number
       (`Low in stock — only ||quantity|| left`);
     - have settings for the icon (icon list or `image_upload`), text,
       background and border colours, radius, padding and typography, with the
       design's values as defaults and in its preset;
     - update when the variant changes. Follow how `_product-usp-item` does it
       (a stable `id` keyed to `block.id` and the `cc-product-usp.js` morph),
       and check by switching between a low-stock and an in-stock variant.
  3. Place it where the design shows it inside the product details, and
     record the new block in the section library.
- **Hero banner (first section of a page).** A large banner directly under the
  header: one image (or a collage that is a single image) edge to edge, usually
  with a heading, sub-heading and button laid over it. Examples: "just in New
  Arrivals" + "Shop now" over a model photo.
  - When the first section is a banner like this, build it with the
    `slideshow` section, even when the design shows only one banner, so the
    merchant can add more slides later. Don't use `hero`,
    `media-with-content` or a plain image section for it.
  - When the first section isn't a banner like this (a split layout, a product
    or collection grid, a video, a section with its own components), don't
    force it into a slideshow. Build it like any other section, in this
    order: an existing section and blocks whose settings can produce the
    design, then a new block added to an existing section, then a new `cc-`
    custom section only when neither can (see "Build the page").
  - The base theme's `templates/index.json` already starts with a `slideshow`.
    Keep that section and edit its slides, don't replace it with another type.
    On any other template, add a `slideshow` as the first section from the
    `Slideshow: Full frame` preset.
  - One `_slide` block per banner in the frame, in order. A single banner is
    one slide. Take the image, overlay text, buttons, alignment and overlay
    from the frame onto the slide's blocks; delete the preset slides the
    design doesn't show.
  - Set `section_width` to `full-width` when the banner touches the screen
    edges, `page-width` when it sits inside the grid. Pick the `slide_height`
    option closest to the frame's height (`auto` follows the image).
  - Put the desktop image in the slide's `image_1` and, when there is a
    separate mobile frame, its crop in `image_2`, so each breakpoint shows its
    own image. Keep `media_type_1` on `image`.
  - Show the slide controls (arrows, dots) only if the design draws them. A
    one-slide banner has none.
- **Instagram feed.** A grid or row of Instagram posts, usually with an
  `@handle` or a "Follow us" heading.
  - Use the `section` **Instafeed** preset, whose `cc-instafeed` block is the
    mount point for the Instafeed app. Copy the preset's block structure, put
    the design's heading and handle in its `header` group, and set the block's
    `dgap` / `mgap` from the grid's gaps.
  - Don't build the posts as images or a new `cc-` section, and don't download
    or upload the post images: the app pulls them from Instagram.
  - List "install and connect the Instafeed app" for the merchant.

When a design repeats a component that isn't on this list, and it's the same
kind of thing across stores (a size guide link, a delivery estimate, a
payment icons row), log it as a gap. `improve-skills` can then add it here.

### Standard pages: 404, search, Visit the Store

Most designs leave these pages out. When the design has a frame for one, build
it from the frame like any other page. Otherwise set it up as below, with this
store's global settings, and use the home page as the style reference. Then
measure it like any page: its spec comes from the home page elements it copies.

- **404** (`templates/404.json`):
  - The heading and body text take the home page's heading and body styling.
    Use the `type_preset` of the matching global style (`h1`–`h6`,
    `paragraph`, the same one the home page's section headings and body text
    use in `templates/index.json`) instead of the template's `custom` font,
    size and case. Use the same text colour as on the home page. Keep the copy
    and the button.
  - Add a `collection-list` section after `main` with 4 collections. Use the
    store's collections for **Tops, Bottoms, Accessories and Shoes**, matched
    by title or handle, singular or plural ("Top", "Tops", `tops`). List them
    with `shopify store execute` (`collections(first: 250) { nodes { handle
    title } }`). Fill a missing slot with the next collection in the main
    menu's top level. If the store still has fewer than 4, leave the slot out
    and add it to the merchant to-do. Without store access, leave
    `collection_list` empty and add it to the to-do. Never invent a handle.
  - Style it like the home page's collection list if it has one (copy that
    section's settings and block tree). Otherwise use the
    `Collection list: Grid` preset with `columns` and `max_collections` 4.
- **Search** (`templates/search.json`):
  - In the `search-results` section's `filters` block, set `enable_filtering`
    and `enable_sorting` to `false`. Keep the block's other settings.
  - Give the results the same product card as the collection page: copy the
    `_product-card` block's settings, child blocks and `block_order` from
    `templates/collection.json`'s `main-collection` section into the
    `search-results` card. Keep the block's own ID and `static` flag. Also
    copy `product_card_size`, `mobile_product_card_size`,
    `columns_gap_horizontal` and `columns_gap_vertical`.
- **Visit the Store** (`templates/page.visit-the-store.json`, the page
  `shopify-pages` creates). Its image, heading, text and Directions button
  live in the first section, and the map in the `custom-liquid` section:
  - **Address and hours**: take them from the design (footer, contact page,
    store locator) first. Otherwise open the store's public Google Maps
    listing in the browser (search the store name and city) and read the
    address and opening hours. Put the address, then the hours (one line per
    day or day range), in the text block. Anything you can't find stays
    empty and goes on the merchant to-do. Never guess an address or hours.
  - **Directions**: the button links to
    `https://www.google.com/maps/dir/?api=1&destination=<URL-encoded address>`,
    with `open_in_new_tab` on.
  - **Map**: set the `custom-liquid` section's `custom_liquid` to an embed of
    the same address:
    `<iframe src="https://www.google.com/maps?q=<URL-encoded address>&output=embed" title="Map of <store name>" width="100%" height="450" style="border:0" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>`.
    Leave it empty when there's no address.
  - **Feature image**: never download photos from Google Maps. They're
    covered by Google's terms and usually belong to whoever took them. Use a
    storefront image from the design if it has one (upload it with
    `shopify-files`). Otherwise leave `image` empty and add a merchant to-do:
    "Visit the Store: pick a storefront photo from the Google Maps listing
    (<listing URL>) or from the client, upload it to Content > Files, and set
    it on the page's image".
  - Heading and text take the home page's heading and body styling, as on
    the 404 page.

### Skip pages that already match

Before building a page, check whether the downloaded theme already matches it:

1. Find the page's template (`templates/index.json`, `templates/product.json`, ...)
   in the inventory's "Current layouts" and read its sections and blocks in order.
2. Compare them with the Figma frame: same sections in the same order, same
   blocks and content, and layout settings (spacing, alignment, width, columns)
   that fit the design. Global tokens were already applied in step 3, so judge
   colours and fonts through those.
3. If a browser tool and a preview URL are available, measure the page against
   its spec (`references/design-match.md` steps 1–3). A page with any fixable
   mismatch doesn't match: build it as below. Keep the spec you wrote, so
   building the page doesn't read Figma again.

If the page matches, don't touch its template. Add it to the **QA later** list
with the template path, the Figma frame, and how you checked it (template only,
or template and screenshots), then move on to the next page. If anything differs,
or you can't tell, build the page as below.

### Build the page

Read `references/design-match.md` first. Every section is built against an
exact spec and checked by measuring it, and that file covers both.

First, write the spec for each section of the page (design-match step 1). Then
list the page's sections from top to bottom and match each one to an existing
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
- Standalone text links ("View all looks", "Shop now →", "Read more" next to
  or under a heading, with no fill or border) are `button` blocks too, never
  a `text` block with a link in its rich text. Pick the style by what the
  design needs:
  - **Link** (`button-unstyled`) when the paragraph font matches the design.
    It only adds `link_text_color` and `underline`; set those to match.
  - **Custom** (`button-custom`) when the link needs its own size, weight,
    letter spacing or uppercase, as small letter-spaced caps links do. Make it
    look like a link: background, border and hover background
    `rgba(0,0,0,0)`, text and hover text the design's colours,
    `custom_padding_block` and `custom_padding_inline` 0, then set `font`,
    `font_size` / `font_size_mobile`, `weight`, `letter_spacing(_mobile)` and
    `case` from the design.
  - An arrow uses the block's `icon` setting (`icon_position` right). Styling
    neither style has a setting for (an underline on a Custom link, a custom
    hover) goes up the design-match fix ladder like any other gap.
  - A heading with the link on the same row (heading left, link right): put
    both in a `group` with `content_direction` row, `horizontal_alignment`
    `space-between` and `vertical_alignment` from the design (usually
    `flex-end`), so the link stays a real block the merchant can edit.
- Components in **Recurring store components** (quick links bar, purchase
  benefits, stock alert, Instagram feed) follow the rules there.
- Use the theme's settings as far as they go: global settings, then section and
  block settings. Only create a new section, block, snippet or asset when no
  existing one can build the component. Name it with a `cc-` prefix
  (`sections/cc-feature-banner.liquid`) and follow the `horizon-theme` skill.
- Styling that no setting can reach goes in the owner `cc-` section or block's
  own `{% stylesheet %}` tag, or becomes a new setting when it varies per
  instance. Never edit a stock (non-`cc-`) file for it: list it as a `manual`
  fix. Follow the fix ladder in design-match step 4.
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

When the page is built, run the design-match loop (`references/design-match.md`
steps 2–5) on every section before moving on:

1. If the project has a theme ID (`themeId` in `.twin-dev.json`), push the changed files to
   it as the `shopify-theme-deploy` skill describes. Otherwise run
   `shopify theme dev` and use the local preview URL.
2. Measure each section at the desktop frame's width, then at the mobile
   width, against its spec.
3. Fix every mismatch with the fix ladder, push, and measure again. Keep going
   until only `manual`, `content`, `theme limit` or `design` mismatches remain, or two
   rounds in a row change nothing.

Mark the page `matched` in the build log, with the remaining mismatches and
their labels. Without a browser tool, say so, mark the page `built` (not
checked), and leave the comparison to the `qa-checker` agent.

## 5. Menus

Do this before step 4 builds the header and footer.

Read every menu in the design: header nav, mega menu, mobile drawer, footer
columns, and utility or legal links. First run the `shopify-pages` skill, so every
page the menus link to exists. Then create each menu in the Shopify admin with the
`shopify-menus` skill. That skill names them `Momentum - <Menu name>` and links
anything still missing (collections, products) to `#`. Then point the header and footer menu settings at the new
menus as that skill's step 4 describes.

## 6. Assets

- Never download Instagram feed images (the post tiles in an Instagram
  section): the `cc-instafeed` block shows them from the Instafeed app.
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
- the design match for each page: elements measured, mismatches fixed by
  setting, by new `cc-` file, by `{% stylesheet %}` CSS and by new setting, and
  what remains with its label (`manual`, `content`, `theme limit`, `design`);
- the **Manual fixes** list: every mismatch that needs a stock (non-`cc-`) file
  change, with the element, Figma vs live value, owner file and suggested
  change;
- contrast failures found in the design.
