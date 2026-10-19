# twin-dev

Claude Code plugin with skills and agents for Shopify Horizon theme work.

## Install on a computer

In Claude Code:

```
/plugin marketplace add lvdlrs/twin-dev
/plugin install twin-dev@twin-dev
```

The repo is private, so git on that computer must be logged in to GitHub
(for example `gh auth login`).

## Update

After pushing changes to this repo, on each computer:

```
/plugin marketplace update twin-dev
```

Bump `version` in `plugins/twin-dev/.claude-plugin/plugin.json` when you release changes.

## What's inside

### Skills

| Skill | Use |
|---|---|
| `/twin-dev:horizon-theme` | Horizon conventions. Loads automatically when editing theme code. |
| `/twin-dev:shopify-theme-deploy` | Safe preview / push / pull / publish with Shopify CLI. Manual only. |
| `/twin-dev:new-store-theme` | Start a store build: copy the base Horizon theme into a new project folder, name it `<Store> x Hv<version>(Momentum in progress...)`, push it into a target theme ID (Horizon added from the Theme Store, so it keeps update notices) or as a new unpublished theme, then build the Figma design. |
| `/twin-dev:figma-to-theme` | Pull colours, type, spacing and layouts from Figma into theme settings and sections. Each section is built against a spec, measured in the browser and fixed until it matches 1:1 (see [Design match](#design-match)). Recurring store components (quick links bar, purchase benefits, stock alert, Instagram feed) are built with set theme components. |
| `/twin-dev:shopify-store-auth` | Connect Shopify CLI to a store: check the CLI, log in for theme pushes, authorize menu, page and file scopes, and verify. Run it before the first build on each store. |
| `/twin-dev:shopify-files` | Download images from Figma, upload them to Shopify Files with alt text, and set them in the theme's image settings. Instagram feed images are skipped: the `cc-instafeed` block pulls them from the Instafeed app. |
| `/twin-dev:shopify-pages` | Create the pages the design links to (plus Visit the Store, All Looks, All Brands), match their templates to the live theme's names, and add missing templates to live as copies of its `page.json`. Run before `shopify-menus`. |
| `/twin-dev:section-library` | Search and reuse `cc-` sections from past stores (client-customized copies and older base versions included), port them to this project's base, and record new builds. Run `library.mjs scan` once to index past projects. |
| `/twin-dev:shopify-menus` | Create, update, back up and restore navigation menus in the Shopify admin (via `shopify store execute`). Shipping, Returns and Privacy items link to the store's policies, or `#` if a policy isn't set up. A quick links row under the header gets its own `Momentum - Mobile Quick Links` menu on the `cc-header-quick-links` section. |
| `/twin-dev:improve-skills` | Turn the failure log's repeated failures, user corrections and gaps into rules in the skills and agents (edits the repo after you approve), and mark those entries as promoted. |

### Agents

| Agent | Use |
|---|---|
| `store-builder` | Build or continue a store from Figma end to end, without asking questions: project folder, target or new unpublished theme, tokens, sections, menus, images. Runs the design-match loop on every page and reports the match counts, a **Manual fixes** list and the merchant to-do. Saves its progress and decisions in `.twin-dev.json` and resumes from there. Each run does one stage (setup to pages, one page, or menus and the final check), and Claude starts the next run until the build is done, so no single run's context grows large. Run `qa-checker` after it. |
| `theme-reviewer` | Review changed Liquid/schema/CSS/JS before pushing. |
| `theme-explorer` | Find where something is rendered, styled or configured. |
| `accessibility-auditor` | WCAG 2.2 AA audit of sections and components. |
| `schema-locale-checker` | Cross-check schemas, presets, templates and translation keys. |
| `qa-checker` | Pre-launch QA: code, templates, settings, browser pass, and Figma vs preview 1:1 with every discrepancy listed. Uses the same design-match standard as the build, and names the fix for each discrepancy. |

Ask for an agent in plain words, for example "use the theme-reviewer agent on my changes".

To start a store build, give the store-builder its inputs by name:

```
Use the store-builder agent:
storeName "Acme Coffee Co"
figmaUrl https://www.figma.com/design/...
store acme-coffee.myshopify.com
themeId 123456789012
altText claude
scope home page, product page
```

| Input | Required | If you leave it out |
|---|---|---|
| `storeName` | No | Taken from the Figma file's name, minus words like "Design", "Website", "Shopify", "v2". |
| `figmaUrl` | **Yes** | The build stops: there's nothing to build. |
| `store` (`<store>.myshopify.com`) | No | Builds locally only. Push, images and menus are marked `blocked` until you add it. |
| `themeId` | No | Pushes a new unpublished theme, which won't get Horizon update notices. |
| `baseTheme` | No | Uses `$TWIN_DEV_BASE_THEME`, then `baseTheme` in `~/.claude/twin-dev/config.json`, then clones the base theme repo. |
| `altText` | No | Who writes the alt text for uploaded images. `user` (default): images upload without it and are listed in the report to fill in under **Content > Files** (the logo and decorative images still get theirs). `claude`: Claude looks at each image and writes it, which costs more tokens on image-heavy designs. |
| `scope` | No | The whole design. Name pages or sections to limit it. |

Anything else in the message (a font, a colour, a page to skip, "rebuild the
home page") is saved as an answer and used for the rest of the build. Inputs
are saved to `.twin-dev.json`, so a later run only needs the store name.

For a new store, run `/twin-dev:shopify-store-auth <store>.myshopify.com` first
so the build doesn't stop for a login.

A build runs in stages to keep token use down: `start` (setup, push, pages,
menus, global settings, images), then one run per page, then `finish` (section
library, final check and the full report). Pages are built in this order:
header and footer, home, collection, product, 404, search, Visit the Store,
then the other content pages. When the design has no frame for 404, search or
Visit the Store, they get the standard setup:
- **404**: home page text styles, plus a Collection List of Tops, Bottoms,
  Accessories and Shoes.
- **Search**: filtering and sorting off, and the collection page's product card.
- **Visit the Store**: address and hours, a directions link and a map embed.
  The photo is left for you to pick from the store's Google Maps listing. Every run's context starts small instead of
growing for the whole build. Each run but the last ends with status `continue`
and a short report, and Claude starts the next run on its own. To do it all in
one run anyway, say "the whole build in one run".

If a run ends with steps blocked (for example it needs store auth), fix what the
report lists and run it again. It picks up from the first unfinished
step and keeps its earlier decisions, unless your message overrides them:

```
Use the store-builder agent: continue "Acme Coffee Co". Headings use Inter.
```

## Per-store details

Every store has its own domain, theme and Figma design, so nothing is hardcoded.
`new-store-theme` writes them to `.twin-dev.json` in the store's project folder,
and every skill and agent reads them from there:

```json
{ "store": "acme-coffee.myshopify.com", "themeId": 123456789012, "figmaUrl": "https://www.figma.com/design/..." }
```

To keep Horizon update notices, add Horizon from the Theme Store first
(**Online Store > Themes > Add theme**) and give its ID when starting the build
(`--theme-id`, or "build into theme 123456789012"). The build is pushed into
that theme and saved with `"themeSource": "existing"`. Without one, a new
unpublished theme is pushed (`"pushed"`), which Shopify treats as uploaded and
never offers updates for.

A value given in the conversation overrides the file. Missing values are asked
for once and saved back. Storefront passwords are never saved.

`qa-checker` also works on an existing store with no `.twin-dev.json`: give it
the preview link (and the Figma link for a design match), or run it in a theme
folder that has `shopify.theme.toml`. It uses a running `shopify theme dev`
(`http://127.0.0.1:9292`) when there is one, otherwise the preview URL, and saves
what it found to `.twin-dev.json` for next time.

Agents can't ask questions mid-run. When `qa-checker` is missing something (a
Figma link, the theme ID, the storefront password), it finishes what it can and
returns a **Need from you** list: ask the user for each item, save the domain,
theme ID and Figma link to `.twin-dev.json`, and run it again.

## Design match

`figma-to-theme`, `store-builder` and `qa-checker` share one standard,
[`references/design-match.md`](plugins/twin-dev/skills/figma-to-theme/references/design-match.md),
so a page the build calls a match is also a match in QA:

1. **Spec**: one row per element of each Figma section (colour, font size,
   weight, line height, letter spacing, box, padding, gaps), saved in the
   project's `figma-build.md`.
2. **Measure**: the live section at the frame's exact width, with one browser
   script.
3. **Tolerance**: colour, spacing, font size and font weight must match exactly;
   everything else within 1px.
4. **Fix ladder**: global setting, then section or block setting, then a
   reused or new `cc-` section or block, then CSS in the `cc-` file's own
   `{% stylesheet %}` or a new setting. Stock (non-`cc-`) files are never
   edited: those changes are listed as `manual` fixes for a developer.
5. **Loop** until only `manual`, `content`, `theme limit` or `design`
   mismatches remain.

The same file has the **Keep the context small** rules that every build and QA
run follows. Each Figma node is read once and its spec reused. Screenshots are
one per section per width, never full page, and each image is looked at once.
Fix rounds compare numbers only. Long command output is filtered down to what's
needed.

### Recurring store components

Most designs have these, styled differently per store. They're recognised by
what they do and where they sit, and always built the same way:

| Component | Built with |
|---|---|
| Quick links bar under the header | `cc-header-quick-links` section (carousel) with a `Momentum - Mobile Quick Links` menu |
| Purchase benefits / USPs | `product-usp` block; a stock row is tied to inventory |
| Stock alert | An existing product block that fits, otherwise a new inventory-tied `cc-` block |
| Instagram feed | The Instafeed preset (`cc-instafeed` block). Post images aren't downloaded; "install and connect the Instafeed app" goes on the merchant to-do |

A repeated component that isn't listed is logged as a gap, so
`/twin-dev:improve-skills` can add it.

## Section library

Every `cc-` section and block from past store projects, indexed so new builds
reuse them. Each entry is marked `base` (same as the base theme at the version
that store started from), `customized` (a base section changed for that client)
or `custom` (built only for that client), with the store's base version.

Index past projects once. It needs the base theme's git repo so each store is
compared with the right base version: each project's `.twin-dev.json` records
the `baseTheme` it was copied from. Otherwise it uses `baseTheme` in
`~/.claude/twin-dev/config.json` (or `$TWIN_DEV_BASE_THEME`), and with neither
set it clones [capital-horizon-theme](https://github.com/lvdlrs/capital-horizon-theme)
into `~/.claude/twin-dev/base-theme`. So on a new computer the config only needs
the projects folder:

```json
{
  "projectsDir": "D:/path/to/Projects"
}
```

Add `"baseTheme": "<path>"` to use your own local copy of the base theme
instead (for example while you're changing it), or `"baseThemeRepo": "<url>"`
to clone a different repo. When the base theme moves to the organization repo,
change `BASE_THEME_REPO` in `new-project.mjs` and `library.mjs`.

Then:

```
node plugins/twin-dev/skills/section-library/scripts/library.mjs scan
```

After that, `figma-to-theme` and `store-builder` search it before building a
section and add each finished project to it. The library is saved in
`~/.claude/twin-dev/library`; set `TWIN_DEV_LIBRARY_DIR` to a shared folder to
share it with the team. New projects record the base commit they were copied
from (`baseCommit` in `.twin-dev.json`).

## Shopify docs

The plugin starts Shopify's Dev MCP server (`shopify-dev-mcp`, needs Node.js 18+)
for docs search and Liquid, theme and GraphQL validation. Check it's connected
with `/mcp`. The config in `plugins/twin-dev/.mcp.json` uses `cmd /c npx` for
Windows; on macOS or Linux change it to `"command": "npx"` with
`["-y", "@shopify/dev-mcp@latest"]`.

## Failure log

Every skill and agent records what went wrong in one shared file on each computer:
`~/.claude/twin-dev/failures.md` (outside the plugin, so updates don't wipe it).
Before starting, each one reads its own past entries and reuses the recorded
fixes instead of repeating a failed approach.

```markdown
## 2026-10-15 · shopify-menus · acme-coffee.myshopify.com
- **Tried:** shopify store execute menuCreate
- **Failed:** "Access denied for menuCreate field"
- **Cause:** CLI app missing write_online_store_navigation scope
- **Fix:** re-ran `shopify store auth` with the scope
```

Failures are tool, command or API errors, failed checks, retries, wrong
assumptions and anything the user corrected. Issues an agent finds in the theme
are findings, not failures. `theme-explorer` can't write files, so it lists its
failures in its report for the main session to log. Secrets and customer data are
never logged.

**Gaps** are logged too: times a skill had no rule for something, so the agent
worked it out or the user said what to do.

```markdown
## 2026-10-19 · shopify-menus · gap · acme-coffee.myshopify.com
- **Missing:** no rule for Shipping / Returns / Privacy menu items
- **Did:** linked them to the store policies, "#" when a policy is missing
```

The log only lives on one computer. To share what it taught, run
`/twin-dev:improve-skills` every so often (or after a build with failures). It
groups the entries by skill, proposes a rule for each repeated failure, user
correction and gap, edits the skills in this repo once you approve, bumps the
plugin version and marks the entries `Promoted` or `Dismissed`. Commit and push,
then update the plugin on the other computers.

## Add more

- Skill: `plugins/twin-dev/skills/<name>/SKILL.md` with `name` and `description` frontmatter.
- Agent: `plugins/twin-dev/agents/<name>.md` with `name`, `description` and optional `tools` / `model`.
