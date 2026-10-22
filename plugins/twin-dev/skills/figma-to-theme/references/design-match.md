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

Fix each mismatch at the first level that can reach the exact value. Never
skip ahead to code when a setting can do it.

**Use existing settings as much as possible; add only what they can't achieve.**
Settings, presets and styles that already exist in the theme come first, so a
Horizon update stays easy to merge. Don't edit or rename the theme's existing
settings or presets, and don't add a new setting or CSS for something an
existing one already covers. Add (level 3 or 4) only when no existing setting
can reach the value.

Line height is the clearest case: when the element has a line-height setting,
use the closest preset and stop, even if the result is a little off. Add a
setting or CSS only when the element has no line-height setting at all.

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
4. **Styling the settings can't reach, in a `cc-` file.** These are values
   outside a setting's range or options: negative letter spacing, a shadow, a one-off radius, a hover state. Only do this
   when the element is rendered by a `cc-` section or block.
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
5. **Needs a stock-file change: label it `manual`.** Never edit a stock
   (non-`cc-`) file to fix a mismatch: not its Liquid, `{% stylesheet %}`,
   schema, `assets/` CSS, `config/settings_schema.json` or
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

   These and `manual` are the only mismatches allowed to remain.

Before you add CSS or a setting to a `cc-` file, check that no existing
setting, utility class or snippet (`typography-style`, `spacing-style`,
`gap-style`, `size-style`) already covers it. Keep each change additive: never
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

Fix global settings before section-level ones. One wrong token can cause dozens
of mismatches, so the first round on the first page is usually where most
global fixes happen.

Record per section in `figma-build.md`: elements measured, mismatches found,
fixed, and remaining with their labels. Keep a **Manual fixes** list at the
top of `figma-build.md` with every `manual` item (element, Figma vs live value,
owner file, suggested change). A page is `matched` when every section
is done, or `built` (not checked) when no browser tool was available.
