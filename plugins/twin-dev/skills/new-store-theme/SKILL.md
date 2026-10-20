---
name: new-store-theme
description: Start a new store build from the local base Horizon theme - copy it into a new project folder, name it "<Store> x Hv<version>(Momentum in progress...)", push it into an existing theme ID (Horizon added from the Theme Store, so it keeps update notices) or as a new unpublished theme, then build the Figma design into it. Use when the user starts a new store or client project, or gives a Figma design for a store that has no project folder yet.
argument-hint: "<Store name> [figma.com link] [--store <store>.myshopify.com] [--theme-id <id>]"
model: sonnet
effort: medium
---

# New store theme

You're a Shopify Theme Developer starting a new store build: you set up the
project from the base Horizon theme, push it to the store and build the Figma
design into it.

Workflow for a new store build:

1. Get the Figma design.
2. Copy the local base Horizon theme (the customized copy of the organization repo).
3. Create a project folder and theme name for the store.
4. Push it into the target theme ID if there is one, otherwise as a new unpublished theme.
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
- A **gap** isn't an error: the instructions had no rule for something you
  met, so you worked it out or the user told you what to do. Log it as a gap
  entry (below), so `improve-skills` can turn it into a rule.
- Never write passwords, tokens, API keys or customer data into the log.

Entry format (newest at the bottom):

```markdown
## YYYY-MM-DD · new-store-theme · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

Gap entry:

```markdown
## YYYY-MM-DD · new-store-theme · gap · <store>.myshopify.com (or "no store")
- **Missing:** what the instructions didn't cover
- **Did:** what you did, or what the user said to do
```

## 0. Inputs

Collect these before you start. Ask for anything that's missing; never guess it.

| Input | Notes |
|---|---|
| Store name | As the client writes it, for example `Acme Coffee Co`. |
| Figma link | `figma.com/design/...`, this store's design. It can come later, but step 4 needs it. |
| Base theme folder | `--base`, else `$TWIN_DEV_BASE_THEME`, else `baseTheme` in `~/.claude/twin-dev/config.json`, else the script clones the base theme repo into `~/.claude/twin-dev/base-theme` (and pulls it on later runs). Don't ask for it. |
| Store domain | `<store>.myshopify.com`, needed for the push. |
| Target theme ID | Optional. An existing **unpublished** theme to build into, normally Horizon added from the Theme Store (see below). Ask for it once; if the user has none, push a new theme. |
| Projects folder | `--dest`, else `$TWIN_DEV_PROJECTS_DIR`, else `projectsDir` in `~/.claude/twin-dev/config.json`. Don't ask unless the script says none is set; then ask once and save the answer to that config file so it's remembered on this computer. |

### Why a target theme

A theme created by `shopify theme push --unpublished` (or uploaded as a zip) is
an uploaded theme: Shopify never shows it update notices for new Horizon
versions. A theme added from the Theme Store keeps that link. So the preferred
setup is:

1. In the admin: **Online Store > Themes > Add theme > Visit Theme Store**,
   find **Horizon** and add it to the theme library (don't publish it).
2. Copy its ID from `shopify theme list --store <store>.myshopify.com` or from
   the editor URL (`.../themes/<id>/editor`).
3. Give the ID to this skill (`--theme-id`). The build is pushed into that
   theme instead of a new one.

If the user doesn't have one, offer this once, then carry on without it.

## 1. Update the base theme

With no base theme set, the script uses its own clone in
`~/.claude/twin-dev/base-theme` and pulls it itself: skip this step.

Otherwise the base theme is the user's own local copy of the repo. Before
copying it:

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

Add `--theme-id <id>` when there's a target theme. Leave out `--domain`,
`--figma` or `--theme-id` if you don't have them yet.

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
- puts it in the Projects folder (`--dest <dir>`, else `$TWIN_DEV_PROJECTS_DIR`,
  else `projectsDir` in `~/.claude/twin-dev/config.json`);
- stops if that folder already exists. Never delete or overwrite an existing
  project folder: tell the user and ask whether to work in the existing folder
  or use a different store name.

Show the user the theme name and folder path. If the name was abbreviated, ask
whether the initials are fine. Then run it again without `--dry-run`. It copies
the theme without `.git`, `node_modules` and `.shopify`. It also writes
`.twin-dev.json` in the new folder: this store's details (store name, version,
theme name, `store` domain, `figmaUrl`, `themeId` and `themeSource`:
`existing` for a target theme, `pushed` once step 3 creates one). Every other
twin-dev skill and the `qa-checker` agent read it, so they work on this store
without asking again. Shopify CLI doesn't upload root files, so it stays local.

From here on, work only in the new folder. Never edit the base theme.

## 3. Push the theme

Follow the `shopify-theme-deploy` skill's preflight (confirm the store, list
themes, `shopify theme check`). Then, from the new folder, use **A** if there's
a target theme ID (from the user or `themeId` in `.twin-dev.json`), else **B**.

### A. Into the target theme

1. Find the ID in `shopify theme list --store <store>.myshopify.com --json`.
   - Not there: tell the user and ask for the right ID. Don't fall back to B
     on your own.
   - Role `live` (published): stop. Never push a build into the live theme;
     ask for an unpublished one.
2. Check it's the same Horizon version as the base theme. Pull only its schema
   into the scratchpad, never into the project folder:

   ```bash
   shopify theme pull --store <store>.myshopify.com --theme <id> --only config/settings_schema.json --path "<scratchpad>/target-theme"
   ```

   Compare `theme_info.theme_name` and `theme_version` with the base theme's.
   - Not Horizon: stop and ask.
   - Different version: tell the user both versions. If the target is older,
     they can update it in the admin first; if it's newer, the base theme repo
     needs updating. Ask whether to push anyway.
3. If the theme has been edited already (the user says so, or its name isn't
   the Theme Store's default `Horizon`), warn that the push replaces its files
   and get a yes.
4. Rename it and push every file into it (no `--unpublished`, no `--ignore`):

   ```bash
   shopify theme rename --store <store>.myshopify.com --theme <id> --name "<theme name>"
   shopify theme push --store <store>.myshopify.com --theme <id> --json
   ```

5. Save `store`, `themeId` and `themeSource: "existing"` in `.twin-dev.json`.

### B. As a new unpublished theme

```bash
shopify theme push --store <store>.myshopify.com --unpublished --theme "<theme name>" --json
```

- This is a new theme, so push every file with no `--ignore` flags.
- Save `store`, the new `themeId` and `themeSource: "pushed"` in
  `.twin-dev.json`.
- Tell the user this theme won't get Horizon update notices, and how to use a
  Theme Store copy next time (see **Why a target theme**).

For both: if the Figma link arrived after step 2, save it as `figmaUrl`, and
give the user the preview and editor URLs.

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
- store, theme ID, whether it's the target theme or a newly pushed one (no
  update notices), preview and editor URLs;
- the `figma-to-theme` report (tokens, section mapping, menus, uploaded images, `#` links, what the merchant still
  has to supply).
