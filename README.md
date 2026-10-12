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

## Add more

- Skill: `plugins/twin-dev/skills/<name>/SKILL.md` with `name` and `description` frontmatter.
- Agent: `plugins/twin-dev/agents/<name>.md` with `name`, `description` and optional `tools` / `model`.
