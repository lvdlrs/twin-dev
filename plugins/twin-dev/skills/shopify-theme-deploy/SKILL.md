---
name: shopify-theme-deploy
description: Safely preview, push, pull and publish a Shopify theme with Shopify CLI without overwriting the merchant's live customizations. Use when the user asks to deploy, push, preview, share or publish a theme.
disable-model-invocation: true
argument-hint: "[dev | push | pull | publish] [--store <store>.myshopify.com]"
---

# Shopify theme deploy

Follow this workflow when moving theme code to or from a Shopify store. The biggest
risk is overwriting merchant customizations stored in `config/settings_data.json`
and `templates/*.json`, so treat those files with care.

## 0. Preflight

Run these and report the results before doing anything else:

```bash
shopify version
shopify theme list --store <store>.myshopify.com
```

- Confirm the store domain with the user. Never guess it.
- Note the **live** theme (`[live]`) ID. Never push to it unless the user explicitly
  says to push to the live theme in this conversation.
- If the folder is a git repo, check `git status` and mention uncommitted changes.

## 1. Check the code

```bash
shopify theme check
```

Fix errors before pushing. Report warnings you leave in place and why.

## 2. Pull merchant changes first

The merchant may have changed settings or templates in the theme editor since your
last pull. Before pushing to an existing theme, pull them:

```bash
shopify theme pull --store <store> --theme <id> --only config/settings_data.json --only "templates/*.json" --only "sections/*.json"
```

If this shows differences from local files, stop and tell the user which files
changed. Ask whether to keep the store versions or the local ones.

## 3. Choose the action

| Goal | Command |
|---|---|
| Local live preview with hot reload | `shopify theme dev --store <store>` |
| New unpublished copy for review | `shopify theme push --store <store> --unpublished` |
| Update an existing unpublished theme | `shopify theme push --store <store> --theme <id>` |
| Push code only, keep merchant data | add `--ignore config/settings_data.json --ignore "templates/*.json"` |
| Share a preview link | `shopify theme share --store <store>` |
| Download a theme | `shopify theme pull --store <store> --theme <id>` |
| Publish | `shopify theme publish --store <store> --theme <id>` |

Defaults:

- Push code changes with the `--ignore` flags above unless the change is meant to
  update templates or settings.
- When templates or settings must change, push those files with `--only` and say
  exactly which ones you are sending.
- Prefer pushing to an unpublished theme and sharing a preview link.

## 4. Publishing

Publishing replaces the live storefront. Before running `shopify theme publish`:

1. Confirm the theme ID and name with the user.
2. Confirm the user has previewed it.
3. Get an explicit "yes, publish" in this conversation.

## 5. Report

Tell the user:

- the store, theme name and ID you pushed to;
- which files were included or ignored;
- the preview / editor URL from the CLI output;
- any check you skipped or that failed.

## Notes

- `shopify theme dev` syncs local edits to a temporary development theme. It
  doesn't touch the live theme.
- If the CLI asks to log in, tell the user to run the command themselves in their
  terminal. Don't try to work around the authentication.
