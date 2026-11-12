# Design match: spec, measure, fix

The `figma-to-theme` build loop and the `qa-checker` agent both use this
standard, so a page the build calls a match is also a match in QA.

The goal is a 1:1 match with the Figma frame on the **core four** (colour,
spacing, font size, font weight), plus layout, components, images, copy and
designed states. Get there in one build run: write the spec, build, measure,
fix, and measure again, without waiting for a person.

## Keep the context small

Every turn of a run re-reads everything already in its context, so each
screenshot and long output is paid for again on every later turn. Measured
numbers decide a match, so spend the context on them, not on pictures.

- **Look at each image once.** Use the image a tool returns. Don't `Read` a
  screenshot file the tool already showed you, and don't open an image again
  later in the run.
- **Screenshot a section, never a full page.** Scroll the section to the top of
  the viewport and take a viewport screenshot (`scale: "css"`, no `fullPage`).
  If the page scrolls inside a wrapper instead of the window (Horizon 4.3's
  `.page-wrapper`), scroll that element. Take a second one only when the
  section is taller than the viewport.
- **When to screenshot:** once per section and width, on its first
  measurement, to check its structure; and once more in a final check. Fix
  rounds compare measured numbers only.
- **Figma:** call `get_design_context` once per section node, when you write
  its spec, never on a whole page. When it returns an image of the node, that's
  the section's Figma screenshot: don't also call `get_screenshot` for it. After
  that, the spec in `figma-build.md` replaces both for later rounds and runs.
- **Browser:** find elements with `browser_evaluate`, not `browser_snapshot`
  (it returns the whole accessibility tree).
- **Command output:** print only what you'll use. Filter long output down to
  errors, counts and the lines you need (`| tail -n 30`, `grep`, or a
  `node -e` that prints selected keys). Never print a whole
  `settings_schema.json`, `settings_data.json`, template or section schema:
  query the keys you need (`theme-inventory.mjs --detail <type>`).
- **Don't re-read** a file you just wrote, or one you read earlier in the run
  that hasn't changed.

## 1. Section spec (before building)

For each Figma section, call `get_design_context` on the section node (on its
child nodes if the section is too big), plus `get_variable_defs` for tokens.
Write a spec with one row per visible element: heading, text run, link, button,
input, badge, price, image, icon, card, divider and container. Write desktop and
mobile values in the same row when the section has a mobile frame.

| # | Element | Text / role | Colour (hex + opacity) | Bg / border | Font size | Weight | Line height | Letter spacing | Case | Box (w × h) | Padding | Gap to next | Radius / shadow |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | section | | | `#F7F3EE` | | | | | | 1440 × 640 | 100 / 100, 80 sides | | |
| 2 | heading | "Made to last" | `#1A1A1A` 100% | | 56 / 36 | 500 | 1.1 | -1.12px | none | | | 16 | |
| 3 | button | "Shop now" | `#FFFFFF` | `#2B76B5` | 14 | 600 | | 0.7px | uppercase | 160 × 48 | 16 / 32 | | 4 |

- Resolve Figma variables and styles to their hex values. Fold layer and fill
  opacity into the colour (`#000000` at 60% is not `#000000`).
- Spacing comes from auto layout padding and `itemSpacing`. For absolutely
  positioned layers, work out the gap from the node bounds.
- Convert units now: line height px or % → a ratio of the font size; letter
  spacing % → px (`size × % / 100`); weight names → numbers (Thin 100,
  ExtraLight 200, Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700,
  ExtraBold 800, Black 900).
- Write the values exactly as Figma shows them, in the frame's own width
  (never scaled or back-solved for the fluid scale; see `figma-to-theme`
  step 2). Take every size, weight, tracking and colour from
  `get_design_context`, never from an earlier decision or memory of another
  section.
- **Setting audit, before measuring.** After building a section, compare its
  saved settings with the spec with a `node -e` that prints only mismatches:
  each font size, letter spacing, weight, colour and spacing setting must equal
  the spec value (desktop and `_mobile`). Fix every difference (and any
  fraction such as 12.2 or 15.3, which means a value was computed, not read)
  before the browser measurement. This catches most mismatches without a
  browser, so the later QA pass has little left to find.
- Under the table, add a **Layout** line: the elements in visual order, the
  columns, and what's visible only on desktop or mobile
  (`heading · text · 2 buttons in a row | image right, 50% · mobile: image first`).
  The structure check in step 2 compares against it.
- Keep the spec in `figma-build.md` under the page. The build uses it as the
  target, and a resumed run reads it instead of calling Figma again.

## 2. Measure the live page

Open the page at the Figma frame's **exact** width: 1440, or the mobile frame's
width (390 if there's no mobile frame).

- Preview URL: keep `preview_theme_id=<id>` on every URL and add `pb=0` to hide
  the preview bar. Local dev server: use its paths.
- Wait for fonts and lazy images: scroll to the bottom and back, wait for network
  idle, and close cookie banners or popups that aren't in the design.
- On a section's first measurement, screenshot it (see **Keep the context
  small**) and check it against the spec's **Layout** line and the Figma image
  for missing, extra or reordered elements. Screenshots can't tell 16px from
  17px, so take every value from the measurement below.

Measure each section with one `browser_evaluate` call (Playwright), or the same
script in another browser tool. Pass the section's id from the template
(`shopify-section-<template>__<section id>`), or its index on the page:

```js
(sel) => {
  const root = document.querySelector(sel);
  const hex = (c) => {
    const m = c.match(/[\d.]+/g); if (!m) return c;
    const [r, g, b, a = 1] = m.map(Number);
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase() + (a < 1 ? ` ${Math.round(a * 100)}%` : '');
  };
  const sr = root.getBoundingClientRect();
  const els = [root, ...root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,input,select,textarea,label,span,li,img,svg,picture,video,[class*="button"],[class*="card"],[class*="badge"],[class*="price"],.group-block,.text-block')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height && getComputedStyle(el).visibility !== 'hidden'; });
  const put = (o, k, v, defaults) => { if (v && !defaults.includes(v)) o[k] = v; };
  return els.map((el, i) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect(), tag = el.tagName.toLowerCase();
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const o = {
      i, tag, cls: String(el.className?.baseVal ?? el.className).trim().split(/\s+/).slice(0, 3).join(' '),
      box: [r.left - sr.left, r.top - sr.top, r.width, r.height].map(Math.round),
    };
    if (own || ['input', 'select', 'textarea'].includes(tag)) Object.assign(o, {
      text: own ? el.textContent.trim().slice(0, 60) : undefined,
      color: hex(s.color), font: s.fontFamily.split(',')[0], size: s.fontSize, weight: s.fontWeight,
      lh: s.lineHeight, ls: s.letterSpacing, tt: s.textTransform, ta: s.textAlign,
    });
    else if (tag === 'svg') o.color = hex(s.color);
    put(o, 'bg', hex(s.backgroundColor), ['#000000 0%']);
    if (parseFloat(s.borderTopWidth)) o.border = `${s.borderTopWidth} ${s.borderTopStyle} ${hex(s.borderTopColor)}`;
    put(o, 'pad', s.padding, ['0px']);
    put(o, 'gap', s.gap, ['normal', 'normal normal', '0px']);
    put(o, 'radius', s.borderRadius, ['0px']);
    put(o, 'shadow', s.boxShadow, ['none']);
    if (tag === 'img' || tag === 'video') o.fit = s.objectFit;
    put(o, 'ar', s.aspectRatio, ['auto']);
    put(o, 'op', s.opacity, ['1']);
    return o;
  });
}
```

The output leaves out defaults to stay short: no `bg` means transparent, no
`border` means none, and no `pad`, `gap` or `radius` means 0. `box` is
`[x, y, w, h]` relative to the section. Type values (`color`, `font`, `size`,
`weight`, `lh`, `ls`, `tt`, `ta`) are only on the element that holds the text,
and on inputs. So a button's font is on the element with its label text, and
its padding, background and border are on the button. An `svg` gets its
`color` for the icon colour.

Also check `document.fonts` for every family and weight the spec uses. A
missing weight file makes the browser fake bold or use the nearest weight, but
`getComputedStyle` still reports the requested weight.

Match each live element to its spec row, one to one. Visible gaps come from
the bounding boxes (next element's `y` minus this element's `y + h`), because
margins, line height and wrappers all change the gap. Compare the visible gap
first, then find the property that causes it.

## 3. Tolerance

- **Core four: exact.** Colour: same hex and same opacity. Font size and
  spacing: same whole pixel after rounding (15.5 vs 16 matches; 16 vs 17
  doesn't). Font weight: same number. "Close enough" is still a mismatch.
- **Everything else**: a mismatch is more than 1px of difference in size or
  position, or any difference in font family, case or copy.
- Ignore sub-pixel rounding and anti-aliasing only.
- **Fluid sizes** (`cc-fluid-value`, `clamp()`): measure at the frame's width
  only, and compare the **setting** with the Figma value too: it must equal
  Figma exactly. A frame narrower than 1440 renders a fluid size slightly
  under the setting; that's the scale, not a mismatch. Never change a setting
  to a non-Figma number to make the measurement match.
- **Sections without a mobile frame**: colour and weight must match the
  desktop frame. Size and spacing follow the mobile tokens and the patterns of
  the mobile frames that do exist. Check for no horizontal scroll and for tap
  targets of at least 44px.

## 4. Fix ladder

Fix each mismatch at the first level whose existing settings can match the
design closely. Never skip ahead to code when a setting can do it.

**Use existing settings as much as possible; add only what they can't achieve.**
Settings, presets and styles that already exist in the theme come first, so a
Horizon update stays easy to merge. Don't edit or rename the theme's existing
settings or presets, and don't add a new setting or CSS for something an
existing one already covers. Add (level 3 or 4) only when no existing setting
can reach the value.

Line height is the clearest case: when the element has a line-height setting,
use the closest preset and stop, even if the result is a little off. Add a
setting or CSS only when the element has no line-height setting at all.

### Maximize the section and block settings first

Levels 3 and below (new settings, new blocks, any CSS) are only allowed after
the section's and its blocks' own settings are used up. Before you leave level 2
for an element, do all of this:

- **Read every setting, not the obvious ones.** Run
  `theme-inventory.mjs --detail <type>` for the section and for each block type
  in its tree, and go through the full list for the element: layout (width,
  columns, gap, padding, alignment, order, each with its `_mobile` twin),
  typography (every `type_preset: custom` field), colours (background, text,
  border, hover, overlay, opacity), shape (radius, border, shadow where
  present), media (ratio, size, position, mobile image) and visibility
  (`show_on_desktop` / `show_on_mobile`).
- **Set the setting that unlocks the others first.** Many settings are hidden
  by `visible_if` until a parent is chosen (`type_preset: custom`,
  `style_class: button-custom`, a custom width, a background type, a border
  style). A setting that looks missing may only be hidden: switch the parent
  on, then look again.
- **Compose with blocks before you reach for CSS.** The layout can often be
  built from existing blocks: wrap items in a `group` (direction, gap,
  alignment, `mobile_order`), add a `spacer`, nest groups, reorder
  `block_order`, use a different block's style variant. Check the allowed
  child blocks and the presets in the inventory.
- **Use the range, then fix the rest.** A value outside a setting's range or
  options (`min`, `max`, `step`, a preset list): set the closest allowed value
  and go down the ladder only for the difference.

Write one line in `figma-build.md` for every element that goes below level 2:
the setting you tried and why it can't produce the value. Without that line, the
element wasn't checked and the fix doesn't count. A QA mismatch that an existing
setting could have fixed means this step was skipped.

1. **Global theme setting.** The value is a token used across the site (all
   H2s, every primary button). Fix it in `config/settings_data.json`, then
   re-measure every section that uses it.
2. **Section or block setting.** Set the value on the instance in the template
   JSON (padding, gap, width, alignment, `type_preset: custom` size, colour).
   Check the setting's range and step with
   `theme-inventory.mjs --detail <type>`.
3. **No section or block for the component.** Search the section library first
   (`section-library` step 2), and reuse or port the closest match. Otherwise
   build a new `cc-` section or block with the `horizon-theme` skill. Give it
   settings for every value the design varies, with the design's values as
   defaults and in its preset.
4. **Styling the settings can't reach.** These are values outside a setting's
   range or options: negative letter spacing, a shadow, a one-off radius, a
   hover state. Where it goes depends on who renders the element.

   **Custom CSS gate: minimal, last resort.** The job is to adjust the existing
   sections and blocks through their settings, not to restyle them in CSS to
   chase 1:1. Pixel-exact applies to what the settings can reach; it never
   justifies CSS on its own. Every rule below, wherever it goes, must pass:
   - Check the element's settings first (`theme-inventory.mjs --detail
     <type>`). If the exact value falls between a setting's steps, use the
     **nearest step** and label it `setting step`; don't add CSS to close a gap
     of 2px or less on spacing or size.
   - CSS is only for a property with **no setting at all** or a value **outside
     its range**. Never for layout: no `display`, `grid`, `flex`, `position`,
     `width`, `height`, `order` or `gap` rules to rearrange a section. Use
     settings, nested `group`/`spacer` blocks, or add the right block.
   - Never restyle a whole component, override a stock class, use `!important`,
     or copy computed styles from Figma. One short rule per value.
   - If one section needs more than about 5 rules, the component is the wrong
     one: go back to level 3.
   - **A stock (non-`cc-`) section or block, or any element of it:** put the
     CSS in Custom CSS, never in the stock file. Choose by reach:
     - **Exclusive to that one section or block instance** (this hero's
       button, that product card's badge on this page): add the rules to that
       instance's own **Custom CSS**, the `custom_css` array on the section or
       block in the template or section group JSON (the "Custom CSS" field at
       the bottom of the section or block in the theme editor). One string per
       rule. Shopify scopes it to that section or block, so use plain
       selectors on the element's own classes, low specificity.
     - **Shared by many instances or pages** (every product card, all H2
       tracking, the header on every page): add it once to the theme's
       **global Custom CSS**, the `custom_css` value in `current` of
       `config/settings_data.json` (Theme settings > Custom CSS in the editor).
       Append only: never rewrite or remove rules already there. If the theme
       has no global Custom CSS field, label it `manual` and don't invent one.
     - When in doubt: one instance → its own Custom CSS; two or more → global.
     - **Custom CSS is the only home for this styling.** Don't put it in a
       utility snippet or asset (`cc-fonts.liquid` is `@font-face` only), in
       `layout/theme.liquid`, in a new `cc-styles`/`custom.css` file, or in any
       stock file. A small style goes in the section's or block's own Custom CSS
       field; a site-wide one in the global Custom CSS in theme settings.
     - Comment each rule with the design value (`/* Figma: H2 tracking
       -1.12px */`). Never use Custom CSS for something an existing setting
       covers (line height presets, padding, colour): that's level 2. Re-measure
       after the push to confirm the rule applies, and record it in
       `figma-build.md` (element, value, which Custom CSS, and why no setting
       could do it).
   - **A `cc-` section or block we build:**
     - **Same for every instance** of that section or block: add the CSS to the
       **owner file's own `{% stylesheet %}` tag**, the `cc-` section or block
       that renders the element. If the file has no tag yet, add one (one per
       file). `{% stylesheet %}` can't contain Liquid, so use the theme's CSS
       variables (`var(--color-foreground)`, `var(--font-h2--size)`) there, not
       settings. Keep the selectors scoped to the file's own classes, low
       specificity, with logical properties. Write a comment naming the design
       value (`/* Figma: H2 tracking -1.12px */`).
     - **Differs per instance**, or a merchant would want to change it: **add a
       setting** to that `cc-` section or block's schema. Give it a new ID, never
       rename existing ones, add the `t:` label to `locales/en.default.schema.json`,
       and set the design value as the default. Output it as an inline custom
       property on the wrapper (`style="--cc-heading-ls: {{ block.settings.heading_letter_spacing }}px"`),
       use the property in the same file's `{% stylesheet %}`, and set the value
       in the template.
     - A one-off tweak on a single instance of a `cc-` section or block that
       the merchant wouldn't change can go in that instance's Custom CSS
       instead, as for a stock section.
5. **Needs a stock-file change CSS can't make: label it `manual`.** Styling
   never lands here, because level 4 covers it through Custom CSS. Only changes
   to markup, Liquid logic, JavaScript, a stock schema (a new setting on a stock
   section or block) or a stock file's own settings list stay `manual`. Never
   edit a stock (non-`cc-`) file to fix a mismatch: not its Liquid,
   `{% stylesheet %}`, schema, `assets/` CSS, `config/settings_schema.json` or
   `snippets/theme-styles-variables.liquid`. A developer makes these changes
   by hand. For each one, record the element, the Figma value, the live value,
   the file that owns the style, and the suggested change (the CSS rule, or the
   setting to add), so it can be applied without measuring again.
6. **Can't be fixed in the theme.** Label the cause instead:
   - `content`: store data differs from the design (product title, image,
     menu item).
   - `theme limit`: a licensed font with no free match, or a feature that needs
     an app.
   - `design`: the Figma file contradicts itself (the same component styled two
     ways, or a mobile frame that contradicts desktop).

   - `setting step`: the nearest value an existing setting offers is within
     2px (or the closest line-height preset), and only custom CSS could close
     the rest. Record the Figma value and the value used.

   These and `manual` are the only mismatches allowed to remain.

Before you add CSS (Custom CSS or a `cc-` file's stylesheet) or a setting, check
that no existing setting, utility class or snippet (`typography-style`,
`spacing-style`, `gap-style`, `size-style`) already covers it. Keep each change additive: never
change or remove existing rules, settings or defaults.

## 5. Loop and stop

For each section, at desktop and then mobile width:

1. Write the spec, build, push the changed files (`shopify-theme-deploy`) or
   use `shopify theme dev`, then measure and take the section's screenshot.
2. List the mismatches and apply the fix ladder to every one of them.
3. Push, measure again (numbers only, no new screenshot), and repeat.

Stop a section when every remaining mismatch is labelled `manual`, `content`,
`theme limit` or `design`. Also stop when two rounds in a row fix nothing:
then log a failure (the value, what you tried, and why it didn't change) and
move on. Don't stop because a fixed number of rounds is used up while fixes
are still landing.

**The QA checker should find almost nothing.** A later QA pass measures the
same spec you do, so every difference it finds is one you left behind. Before
you mark a page `matched`:

- A mismatch that an existing section or block setting can fix (padding, gap,
  width, alignment, line-height preset, a `_mobile` size or letter spacing,
  button padding, an unset colour) may not remain. Listing it as remaining means
  step 2 of the fix ladder was skipped. Only `manual`, `content`, `theme limit`
  and `design` stay.
- Set the mobile settings (`font_size_mobile`, `letter_spacing_mobile`,
  `type_size_h2_mobile`, logo height, section padding, gaps) on every text
  element and section, not only the desktop ones.
- Check `document.fonts` for every weight at the start of the first page, and
  fix missing weights before measuring anything else (see `figma-to-theme`,
  Fonts).
- Do a last full pass over every spec row on a freshly loaded page, desktop and
  mobile, after your final push. Fixes to global settings or shared files can
  move earlier sections.
- Report exact counts, never estimates ("about 60"). Keep the real tally in
  `figma-build.md`.
- Leave no empty link, no unset favicon and no placeholder copy that the
  design gives a value for.

Fix global settings before section-level ones. One wrong token can cause dozens
of mismatches, so the first round on the first page is usually where most
global fixes happen.

Record per section in `figma-build.md`: elements measured, mismatches found,
fixed, and remaining with their labels. Keep a **Manual fixes** list at the
top of `figma-build.md` with every `manual` item (element, Figma vs live value,
owner file, suggested change). A page is `matched` when every section
is done, or `built` (not checked) when no browser tool was available.
