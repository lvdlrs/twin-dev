---
name: shopify-files
description: Download images from a Figma design (logo, hero banners, collection and section images, icons), upload them to Shopify Files (Content > Files) with alt text, and use them in the theme's image settings. Use when the user asks to upload images or assets to Shopify, add alt text, or fill a theme's image pickers from a design.
argument-hint: "[figma.com link | folder of images] [--store <store>.myshopify.com]"
model: sonnet
effort: medium
---

# Shopify files

Get the images a design needs into **Content > Files** with alt text, then point
the theme's image settings at them. Merchant images belong in Files or on
resources, never in the theme's `assets/` folder.

Keep downloads and the manifest in a work folder outside the theme, for example
the scratchpad or `<project>/../<project>-images/`. Never put them in the theme
folder.

## Failure log

Every twin-dev skill and agent records its failures in one shared file,
`~/.claude/twin-dev/failures.md` (all stores, all runs).

- **Before you start**, read your past entries and use the fixes recorded there
  instead of repeating an approach that already failed:
  `grep -n -A5 "· shopify-files ·" ~/.claude/twin-dev/failures.md` (no output or no
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
## YYYY-MM-DD · shopify-files · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

Gap entry:

```markdown
## YYYY-MM-DD · shopify-files · gap · <store>.myshopify.com (or "no store")
- **Missing:** what the instructions didn't cover
- **Did:** what you did, or what the user said to do
```

## 0. Access

Confirm the store domain (`<store>.myshopify.com`) with the user. Never guess it.
Authenticate once, in the user's own terminal if it needs a browser:

```bash
shopify store auth --store <store>.myshopify.com --scopes read_files,write_files
```

The upload script uses `shopify store execute`. If the CLI isn't available, it
uses `SHOPIFY_ADMIN_TOKEN`, or `SHOPIFY_CLIENT_ID` + `SHOPIFY_CLIENT_SECRET`, as
the `shopify-menus` skill describes. Don't ask the user to paste a token into
the chat.

## 1. Collect the images

From Figma (needs the Figma MCP tools), go page by page:

1. `get_metadata` to list the frames, then find each image layer: logo, hero
   and banner images, collection list and card images, image-with-text,
   background images, and icons that aren't in the theme's icon set.
2. `download_assets` for each one. Export photos at 2x the frame size. If the
   desktop and mobile frames crop an image differently and the section has a
   separate mobile image setting, download both.
3. Skip product photos and images of collections or products that exist in the
   store. Those belong on the product or collection, not in Files. List them for
   the merchant instead.
4. Skip Instagram feed images (the post tiles in an Instagram section). That
   section is built with the `cc-instafeed` block, and the Instafeed app pulls
   the posts from Instagram.

From a folder the user gives: use the images in it as they are.

**Formats**: JPG for photos, PNG for images that need transparency, and SVG for
logos and icons when Figma gives vector art. Keep each file under 20 MB. Shopify's
CDN serves WebP/AVIF to browsers on its own, so don't convert.

## 2. Name and describe

Give every file a filename that says what it is and where it's used: lowercase,
hyphens, no spaces, and unique across the store.

```
<store-slug>-logo.svg
<store-slug>-home-hero-desktop.jpg
<store-slug>-home-hero-mobile.jpg
<store-slug>-collection-list-mens.jpg
```

**Who writes the alt text**: ask the user once, before you look at any image:

- **Claude writes it**: follow the rules below. Writing it means looking at each
  image, which costs tokens on image-heavy designs.
- **User writes it**: don't screenshot images for alt text. Leave `alt` out of
  the manifest, except for the logo (store name) and images you already know are
  decorative (`""`). Those files upload with `needsAlt: true`. The user can type
  alt text into the manifest before the upload, or add it later in
  **Content > Files**.

When you write it, write from the image itself (`get_screenshot` of the layer
if you need to see it):

- Describe what matters in the context it's used, in one short sentence, no
  "image of". Example: `Barista pouring latte art into a white cup`.
- Logo: the store name, for example `Acme Coffee`.
- Decorative images (textures, background shapes, images behind text that the
  text already describes): empty alt `""`.
- Don't put marketing copy or keywords in alt text.

Write the manifest:

```json
[
  { "file": "C:/work/acme-images/hero.jpg", "filename": "acme-coffee-home-hero-desktop.jpg", "alt": "Barista pouring latte art into a white cup" },
  { "file": "C:/work/acme-images/logo.svg", "filename": "acme-coffee-logo.svg", "alt": "Acme Coffee" }
]
```

The extension in `filename` must match the real file type.

## 3. Confirm and upload

Show the user a table and get a "yes" before uploading:

| Preview | Filename | Alt text | Used in |
|---|---|---|---|
| hero.jpg | acme-coffee-home-hero-desktop.jpg | Barista pouring latte art… | Home → Hero (desktop) |

Then dry-run, then upload:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/shopify-files/scripts/upload-files.mjs" <manifest.json> --store <store>.myshopify.com --dry-run
node "${CLAUDE_PLUGIN_ROOT}/skills/shopify-files/scripts/upload-files.mjs" <manifest.json> --store <store>.myshopify.com
```

The script uploads, sets alt text, waits for Shopify to finish processing, and
prints each file's `themeRef` (`shopify://shop_images/<filename>`). Files that
already exist with the same filename are reported as `SKIPPED_EXISTS` and aren't
uploaded again. If a file is `FAILED`, show its errors.

## 4. Use them in the theme

Set each `image_picker` setting to the file's `themeRef`:

- Section and block images in `templates/*.json` and `sections/*-group.json`
  (hero, image-with-text, collection list cards with an image override, etc.).
- Logo and favicon in `config/settings_data.json` (`logo`, `logo_inverse` if the
  theme has it, `favicon`). Read `settings_schema.json` for the real IDs.
- Mobile image settings (`*_mobile`) when you uploaded a mobile crop.

If a collection list card has no image override setting, it shows the
collection's own image. Setting that image changes the collection in the admin,
so ask first. If the collection doesn't exist yet, leave the image in Files and
list it for the merchant.

Push the changed templates and settings with the `shopify-theme-deploy` rules.

## 5. Report

- files uploaded, skipped or failed, with filename and alt text;
- files still needing alt text (`needsAlt`), as a checklist: `- [ ] <filename> — <where it's used>`;
- where each one is used (template → section → setting);
- images left for the merchant: product photos, collection images, and anything
  you couldn't download.
