---
name: new-store-theme
description: Start a new store build from the local base Horizon theme - copy it into a new project folder, name it "<Store> x Hv<version>(Momentum in progress...)", push it as an unpublished theme, then build the Figma design into it. Use when the user starts a new store or client project, or gives a Figma design for a store that has no project folder yet.
argument-hint: "<Store name> [figma.com link] [--store <store>.myshopify.com]"
---

# New store theme

You're a Shopify Theme Developer starting a new store build: you set up the
project from the base Horizon theme, push it to the store and build the Figma
design into it.

Workflow for a new store build:

1. Get the Figma design.
2. Copy the local base Horizon theme (the customized copy of the organization repo).
3. Create a project folder and theme name for the store.
4. Push it as an unpublished theme.
5. Build the design into the theme, including the menus (created in the admin as `Momentum - <Menu name>`).

## Failure log

Every twin-dev skill and agent records its failures in one shared file,
`~/.claude/twin-dev/failures.md` (all stores, all runs).

- **Before you start**, read your past entries and use the fixes recorded there
  instead of repeating an approach that already failed:
  `grep -n -A5 "· new-store-theme ·" ~/.claude/twin-dev/failures.md` (no output or no
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
## YYYY-MM-DD · new-store-theme · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

## 0. Inputs

Collect these before you start. Ask for anything that's missing; never guess it.

| Input | Notes |
|---|---|
| Store name | As the client writes it, for example `Acme Coffee Co`. |
| Figma link | `figma.com/design/...`, this store's design. It can come later, but step 4 needs it. |
| Base theme folder | `$TWIN_DEV_BASE_THEME`, or ask. Suggest setting the env var so you don't have to ask next time. |
| Store domain | `<store>.myshopify.com`, needed for the push. |
| Projects folder | Always `D:\Lenmuel Del Rosario\Documents\Employer\Capital Commerce\Projects` (the script's default). `$TWIN_DEV_PROJECTS_DIR` or `--dest` overrides it. Don't ask. |

## 1. Update the base theme

The base theme is a local copy of the organization repo. Before copying it:

```bash
git -C "<base>" status --short
git -C "<base>" fetch
git -C "<base>" status -sb
```

- If the base theme is behind its remote, tell the user and ask whether to
  `git pull` first. Don't pull without asking.
- If the base theme has uncommitted changes, list them and ask whether the copy
  should include them.

## 2. Create the project folder

Preview the plan first:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/new-store-theme/scripts/new-project.mjs" --store "<Store name>" --base "<base>" --domain <store>.myshopify.com --figma "<figma link>" --dry-run
```

Leave out `--domain` or `--figma` if you don't have them yet.

The script:

- reads the version from `theme_info.theme_version` in the base theme's
  `config/settings_schema.json`;
- builds the **theme name** `<Store> x Hv<version>(Momentum in progress...)`.
  Shopify allows at most 50 characters, so when the full name is too long it
  uses the store's initials (`The Really Long Brand Co` → `TRLBC`). Pass
  `--short "<abbr>"` to use a different abbreviation;
- builds the **folder name** `<Store> x Horizon <version>` (for example
  `Acme Coffee Co x Horizon 4.2.0`), keeping the store name as written minus
  characters Windows doesn't allow in folder names;
- puts it in the Projects folder
  (`D:\Lenmuel Del Rosario\Documents\Employer\Capital Commerce\Projects`)
  unless `$TWIN_DEV_PROJECTS_DIR` or `--dest <dir>` says otherwise;
- stops if that folder already exists. Never delete or overwrite an existing
  project folder: tell the user and ask whether to work in the existing folder
  or use a different store name.

Show the user the theme name and folder path. If the name was abbreviated, ask
whether the initials are fine. Then run it again without `--dry-run`. It copies
the theme without `.git`, `node_modules` and `.shopify`. It also writes
`.twin-dev.json` in the new folder: this store's details (store name, version,
theme name, `store` domain, `figmaUrl`, and `themeId` once pushed). Every other
twin-dev skill and the `qa-checker` agent read it, so they work on this store
without asking again. Shopify CLI doesn't upload root files, so it stays local.

From here on, work only in the new folder. Never edit the base theme.

## 3. Push as an unpublished theme

Follow the `shopify-theme-deploy` skill's preflight (confirm the store, list
themes, `shopify theme check`). Then, from the new folder:

```bash
shopify theme push --store <store>.myshopify.com --unpublished --theme "<theme name>" --json
```

- This is a new theme, so push every file with no `--ignore` flags.
- Save the store domain and the new theme ID into `.twin-dev.json` (`store`,
  `themeId`). If the Figma link arrived after step 2, save it as `figmaUrl`.
- Give the user the preview and editor URLs.

## 4. Build the design

Follow the `figma-to-theme` skill in the new folder, and `horizon-theme` for any
code. New custom sections, blocks, snippets and assets use the `cc-` prefix.
Menus from the design are created in the admin with `shopify-menus`, using the
store domain from step 3. Any menu item or section link whose page or collection
doesn't exist yet gets `#`.

When the user wants to see progress, push to the saved theme ID (not
`--unpublished` again, which would create a second theme). Use the
`shopify-theme-deploy` rules:

```bash
shopify theme push --store <store> --theme <themeId>
```

The theme is new and the merchant hasn't edited it yet, so pushing templates and
settings is fine until the user says the client has started editing in the theme
editor. After that, pull before pushing, as `shopify-theme-deploy` says.

## 5. Report

- theme name, folder path and base version;
- store, theme ID, preview and editor URLs;
- the `figma-to-theme` report (tokens, section mapping, menus, `#` links, what the merchant still
  has to supply).
