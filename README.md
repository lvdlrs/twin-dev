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
| `/twin-dev:new-store-theme` | Start a store build: copy the base Horizon theme into a new project folder, name it `<Store> x Hv<version>(Momentum in progress...)`, push it unpublished, then build the Figma design. |
| `/twin-dev:figma-to-theme` | Pull colours, type, spacing and layouts from Figma into theme settings and sections. |
| `/twin-dev:shopify-menus` | Create, update, back up and restore navigation menus in the Shopify admin (via `shopify store execute`). |

### Agents

| Agent | Use |
|---|---|
| `theme-reviewer` | Review changed Liquid/schema/CSS/JS before pushing. |
| `theme-explorer` | Find where something is rendered, styled or configured. |
| `accessibility-auditor` | WCAG 2.2 AA audit of sections and components. |
| `schema-locale-checker` | Cross-check schemas, presets, templates and translation keys. |
| `qa-checker` | Pre-launch QA: code, templates, settings, browser pass, and Figma vs preview 1:1 with every discrepancy listed. |

Ask for an agent in plain words, for example "use the theme-reviewer agent on my changes".

## Per-store details

Every store has its own domain, theme and Figma design, so nothing is hardcoded.
`new-store-theme` writes them to `.twin-dev.json` in the store's project folder,
and every skill and agent reads them from there:

```json
{ "store": "acme-coffee.myshopify.com", "themeId": 123456789012, "figmaUrl": "https://www.figma.com/design/..." }
```

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

## Add more

- Skill: `plugins/twin-dev/skills/<name>/SKILL.md` with `name` and `description` frontmatter.
- Agent: `plugins/twin-dev/agents/<name>.md` with `name`, `description` and optional `tools` / `model`.
