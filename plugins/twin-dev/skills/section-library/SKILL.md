---
name: section-library
description: Search and reuse custom (cc-) sections and blocks built for past store projects, including client-customized copies of base sections and ones built on older base theme versions, and add new builds to the library. Use before building a cc- section or block from a design, when the user asks "have we built this before", wants to reuse or port a section from another store, or after a build to record what was made.
argument-hint: "[search <words> | add | scan | port <id>]"
---

# Section library

Every store project starts from the base theme, and its base `cc-` sections then
get customized for that client, or new ones get built only for that client.
Projects also start from different base versions. The library indexes all of
them so a new build reuses the closest existing section instead of starting
over.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/section-library/scripts/library.mjs" <command> ...
```

The library is in `$TWIN_DEV_LIBRARY_DIR`, else `~/.claude/twin-dev/library`. To
share it with the team, point `TWIN_DEV_LIBRARY_DIR` at a shared folder. It
holds client code, so keep it internal.

## Failure log

Every twin-dev skill and agent records its failures in one shared file,
`~/.claude/twin-dev/failures.md` (all stores, all runs).

- **Before you start**, read your past entries and use the fixes recorded there
  instead of repeating an approach that already failed:
  `grep -n -A5 "· section-library ·" ~/.claude/twin-dev/failures.md` (no output or no
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
## YYYY-MM-DD · section-library · <store>.myshopify.com (or "no store")
- **Tried:** what you were doing, with the command or tool
- **Failed:** the error message or what went wrong, quoted short
- **Cause:** why, if known
- **Fix:** what worked, or `unresolved`
```

## What an entry says

Each `cc-` section and block in each project is one entry (`id` is
`<store>/<path>`), with its schema name, presets, settings, child blocks, the
`cc-` snippets, blocks and assets it depends on (`deps`), and:

| Field | Meaning |
|---|---|
| `status: base` | Same as the base theme's file at the version the project started from. Nothing client-specific. |
| `status: customized` | A base section changed for this client. `linesChanged` says how much. |
| `status: custom` | Not in the base theme: built only for this client. |
| `horizonVersion` | The base version that project is on. |
| `baseRef` | The base commit it was compared with (`baseCommit` in `.twin-dev.json`, else the newest base commit with that version). |
| `baseUpdated` | The base theme changed this file since that version, so the copy is behind the current base. |
| `notes`, `screenshot` | What it looks like and what's custom, written after the build. |

## 1. Backfill (once, and after big changes)

Index every past project in the projects folder:

```bash
node .../library.mjs scan
```

It needs the base theme (`$TWIN_DEV_BASE_THEME` or `--base`) as a git repo to
tell `base` from `customized` per version; without git it compares with the
current base only, and without a base every file counts as `custom`. Then look
through `index.md` in the library and add notes to the `customized` and `custom`
entries you can describe from their code (step 4), so search can find them by
what they look like.

## 2. Search before you build

Before building any `cc-` section or block for a design component, search with
the words that describe it: what the design shows, what it's called in Figma,
what it does.

```bash
node .../library.mjs search shop the look hotspot
node .../library.mjs search brand logo marquee --status custom
node .../library.mjs show <id>
```

`show` gives the entry and its saved files in the library. Read the section
and compare it with the Figma frame (layout, settings, blocks, behaviour).
Then choose, in this order:

1. **The project already has a base `cc-` section that fits.** Customize it in
   place. That's the normal path; the library adds nothing.
2. **A library entry is closer to the design** than the project's own section,
   usually a `customized` or `custom` one from another client. Port it (step 3).
3. **Nothing is close.** Build it new, following `horizon-theme`.

Prefer, among similar entries: closer to the design, then a newer
`horizonVersion`, then fewer `linesChanged`. Say which entry you chose and why.

## 3. Port an entry

Copy the section and every file in its `deps` into the project, then make it fit
this project's base version.

**Same file already in the project** (it came from the base theme): don't
overwrite it. Merge the client's changes onto the project's current file with a
three-way merge, using the base file at the entry's `baseRef` as the common
ancestor:

```bash
git -C "$TWIN_DEV_BASE_THEME" show <baseRef>:<path> > <scratch>/ancestor
git merge-file -p <project>/<path> <scratch>/ancestor <library>/<store>/<path> > <scratch>/merged
```

Exit code 0 means a clean merge; more than 0 is the number of conflicts, marked
in the output. Resolve each one by keeping the project's (newer base) structure
and re-applying the client's intent, then write the result to the project file.
If the entry is `base` status, the project's own copy is already as good or
newer: use it, not the library's.

**New to the project** (`custom` entries and their deps): copy them in. If the
entry's `horizonVersion` is older than the project's:

- Run the `theme-inventory.mjs` script (`figma-to-theme` step 4) and check every
  `render`, `content_for 'block'` type, block type in the schema and asset the
  section uses still exists in this project.
- Compare with the base sections it was modelled on in this version (snippet
  arguments, block names, `{% stylesheet %}` and `{% javascript %}` usage,
  `@theme/` JavaScript imports, CSS variables) and update to match, as
  `horizon-theme` describes.
- Validate it (step 5).

**Always:**

- Remove the other client's specifics: store names, hardcoded copy, colours,
  image URLs and links become settings or this design's values.
- Keep the `cc-` prefix. If the name clashes with a different section in the
  project, rename the ported one and every reference to it.
- Add any translation keys it uses to this project's locales.

## 4. Record what you built

After a build (or a port), index the project and describe each new or changed
entry so the next search finds it:

```bash
node .../library.mjs add --project <project folder>
node .../library.mjs note <id> "Full-width lifestyle image with product hotspots; mobile stacks products under the image. Custom for Acme: heading row and quick add." --screenshot <path>
```

A good note says what it looks like, what it's for, and what's specific to this
client. Use a screenshot you already took while checking the page, if any;
otherwise leave it out. `add` keeps existing notes; re-run it whenever the
project's `cc-` files change.

## 5. Validate

Run `shopify theme check` in the project. If the Shopify Dev MCP server is
connected, also run `validate_theme` on the ported files, and use
`search_docs_chunks` for any Liquid tag, filter or schema setting you're unsure
of in this version. Then build the page as usual and check it against the design.
