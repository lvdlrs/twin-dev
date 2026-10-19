# Design match: spec, measure, fix

The `figma-to-theme` build loop and the `qa-checker` agent both use this
standard, so a page the build calls a match is also a match in QA.

The goal is a 1:1 match with the Figma frame on the **core four** (colour,
spacing, font size, font weight), plus layout, components, images, copy and
designed states. Get there in one build run: write the spec, build, measure,
fix, and measure again, without waiting for a person.

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
- If the desktop frame isn't 1440 wide, scale its values to 1440 (see
  `figma-to-theme` step 2).
- Keep the spec in `figma-build.md` under the page. The build uses it as the
  target, and a resumed run reads it instead of calling Figma again.

## 2. Measure the live page

Open the page at the Figma frame's **exact** width: 1440, or the mobile frame's
width (390 if there's no mobile frame).

- Preview URL: keep `preview_theme_id=<id>` on every URL and add `pb=0` to hide
  the preview bar. Local dev server: use its paths.
- Wait for fonts and lazy images: scroll to the bottom and back, wait for network
  idle, and close cookie banners or popups that aren't in the design.
- Screenshot the section and check it against `get_screenshot` of the frame for
  missing, extra or reordered elements. Screenshots can't tell 16px from 17px,
  so take every value from the measurement below.

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
  const els = [root, ...root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,a,button,input,select,label,span,li,img,svg,picture,video,[class*="button"],[class*="card"],[class*="badge"],[class*="price"],.group-block,.text-block')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.height && getComputedStyle(el).visibility !== 'hidden'; });
  return els.map((el, i) => {
    const s = getComputedStyle(el), r = el.getBoundingClientRect();
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    return {
      i, tag: el.tagName.toLowerCase(), cls: el.className?.baseVal ?? el.className,
      text: own ? el.textContent.trim().slice(0, 60) : undefined,
      x: Math.round(r.left - sr.left), y: Math.round(r.top - sr.top), w: Math.round(r.width), h: Math.round(r.height),
      color: hex(s.color), bg: hex(s.backgroundColor), border: `${s.borderTopWidth} ${s.borderTopStyle} ${hex(s.borderTopColor)}`,
      font: s.fontFamily.split(',')[0], size: s.fontSize, weight: s.fontWeight, lh: s.lineHeight, ls: s.letterSpacing, tt: s.textTransform, ta: s.textAlign,
      pad: s.padding, gap: s.gap, radius: s.borderRadius, shadow: s.boxShadow !== 'none' ? s.boxShadow : undefined,
      fit: s.objectFit, ar: s.aspectRatio, op: s.opacity !== '1' ? s.opacity : undefined,
    };
  });
}
```

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
  only.
- **Sections without a mobile frame**: colour and weight must match the
  desktop frame. Size and spacing follow the mobile tokens and the patterns of
  the mobile frames that do exist. Check for no horizontal scroll and for tap
  targets of at least 44px.

## 4. Fix ladder

Fix each mismatch at the first level that can reach the exact value. Never
skip ahead to code when a setting can do it.

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
   outside a setting's range or options: negative letter spacing, a line height
   between presets, a shadow, a one-off radius, a hover state. Only do this
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
   use `shopify theme dev`, then measure.
2. List the mismatches and apply the fix ladder to every one of them.
3. Push, measure again, and repeat.

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
