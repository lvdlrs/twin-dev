#!/usr/bin/env node
// Library of custom (cc-) sections and blocks built across past store projects.
//
// Usage:
//   node library.mjs scan   [--projects <dir>] [--base <path>] [--library <dir>]
//   node library.mjs add    --project <folder> [--base <path>] [--library <dir>]
//   node library.mjs search <words...> [--status base|customized|custom] [--limit <n>] [--library <dir>]
//   node library.mjs show   <id> [--library <dir>]
//   node library.mjs note   <id> "<what it looks like / what's custom>" [--screenshot <path>] [--library <dir>]
//
//   scan     Index every project folder in the projects folder (a folder with
//            config/settings_schema.json). Defaults to $TWIN_DEV_PROJECTS_DIR, then
//            `projectsDir` in ~/.claude/twin-dev/config.json.
//   add      Index one project folder (run after a build).
//
//   The base theme is --base, else the project's `baseTheme` in .twin-dev.json (when
//   that folder exists on this computer), else $TWIN_DEV_BASE_THEME, else `baseTheme`
//   in ~/.claude/twin-dev/config.json, else the base theme clone that new-project.mjs
//   keeps in ~/.claude/twin-dev/base-theme (cloned here if it's missing).
//
//   search   Rank entries by the words, matched against file, name, presets,
//            settings, blocks, store and notes.
//   show     Print one entry and where its saved files are.
//   note     Save a description (and screenshot path) on an entry. Kept on rescans.
//
// The library lives in $TWIN_DEV_LIBRARY_DIR, else ~/.claude/twin-dev/library:
//   index.json, index.md, and <store>/<theme path> copies of every indexed file.
//
// Each cc- section and block is compared with the base theme at the version the
// project started from (git commit `baseCommit` in .twin-dev.json, else the
// newest base commit with the same theme_version, else the current base):
//   base        identical to the base theme's file
//   customized  the base theme has it, but this store's copy differs
//   custom      not in the base theme (built for this store)
// `baseUpdated` is true when the base theme's file has changed since that version.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const CONFIG_PATH = join(homedir(), ".claude", "twin-dev", "config.json");
// Same repo and clone folder as new-project.mjs.
const BASE_THEME_REPO = "https://github.com/lvdlrs/capital-horizon-theme.git";
const BASE_THEME_CLONE = join(homedir(), ".claude", "twin-dev", "base-theme");
const CC_DIRS = ["sections", "blocks", "snippets", "assets"];
// Opened base themes by folder, so a scan reads each one's git history once.
const bases = new Map();
let cloneFailed = false;

const [command, ...rest] = process.argv.slice(2);
const { args, words } = parseArgs(rest);
const libraryDir = resolve(args.library || process.env.TWIN_DEV_LIBRARY_DIR || join(homedir(), ".claude", "twin-dev", "library"));
const indexPath = join(libraryDir, "index.json");

switch (command) {
  case "scan": {
    const projectsDir = resolveProjectsDir(args.projects);
    if (!existsSync(projectsDir)) fail(`Projects folder doesn't exist: ${projectsDir}`);
    const folders = readdirSync(projectsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => join(projectsDir, d.name))
      .filter(isTheme);
    const index = loadIndex();
    for (const folder of folders) indexProject(index, folder, baseFor(folder));
    saveIndex(index);
    console.log(`Indexed ${folders.length} projects, ${index.entries.length} entries → ${libraryDir}`);
    break;
  }
  case "add": {
    if (!args.project) fail("Pass --project <folder>.", 2);
    const folder = resolve(args.project);
    if (!isTheme(folder)) fail(`Not a theme folder (missing config/settings_schema.json): ${folder}`);
    const index = loadIndex();
    const added = indexProject(index, folder, baseFor(folder));
    saveIndex(index);
    console.log(JSON.stringify(added.map(summary), null, 2));
    break;
  }
  case "search": {
    if (!words.length) fail("Pass words to search for.", 2);
    const index = loadIndex();
    const terms = words.flatMap((w) => tokens(w));
    const results = index.entries
      .filter((e) => !args.status || e.status === args.status)
      .map((e) => ({ e, score: score(e, terms) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || compareVersions(b.e.horizonVersion, a.e.horizonVersion))
      .slice(0, Number(args.limit) || 15);
    console.log(JSON.stringify(results.map((r) => ({ score: r.score, ...summary(r.e) })), null, 2));
    break;
  }
  case "show": {
    const entry = findEntry(loadIndex(), words[0]);
    console.log(JSON.stringify({ ...entry, libraryFiles: [entry.file, ...entry.deps].map((f) => join(libraryDir, entry.storeSlug, f)) }, null, 2));
    break;
  }
  case "note": {
    const index = loadIndex();
    const entry = findEntry(index, words[0]);
    if (words[1]) entry.notes = words.slice(1).join(" ");
    if (args.screenshot) entry.screenshot = resolve(args.screenshot);
    saveIndex(index);
    console.log(JSON.stringify(summary(entry), null, 2));
    break;
  }
  default:
    fail("Commands: scan | add | search | show | note. See the header of library.mjs.", 2);
}

// ---------- indexing ----------

function indexProject(index, folder, base) {
  const meta = readJson(join(folder, ".twin-dev.json")) || {};
  const storeName = meta.storeName || basename(folder).replace(/ x Horizon .*$/i, "");
  const storeSlug = slug(storeName);
  const horizonVersion = readThemeVersion(join(folder, "config", "settings_schema.json"));
  const baseRef = base.refFor(meta.baseCommit, horizonVersion);
  const locale = readJson(join(folder, "locales", "en.default.schema.json")) || {};

  const ccFiles = CC_DIRS.flatMap((dir) => listCc(folder, dir));
  const entries = ccFiles
    .filter((f) => f.startsWith("sections/") || f.startsWith("blocks/"))
    .map((file) => {
      const text = readFileSync(join(folder, file), "utf8");
      const schema = parseSchema(text);
      const deps = [...collectDeps(folder, file, new Set([file]))].filter((d) => d !== file).sort();
      const previous = index.entries.find((e) => e.id === `${storeSlug}/${file}`);
      const atVersion = base.read(baseRef, file);
      const current = base.read(null, file);
      const status = atVersion == null && current == null ? "custom" : normalise(atVersion ?? current) === normalise(text) ? "base" : "customized";
      return {
        id: `${storeSlug}/${file}`,
        store: meta.store || null,
        storeName,
        storeSlug,
        project: folder,
        horizonVersion,
        kind: file.split("/")[0] === "sections" ? "section" : "block",
        file,
        name: label(schema?.name, locale),
        presets: (schema?.presets || []).map((p) => label(p.name, locale)).filter(Boolean),
        settings: (schema?.settings || []).filter((s) => s.id).map((s) => `${s.id}:${s.type}${s.label ? ` (${label(s.label, locale)})` : ""}`),
        blocks: (schema?.blocks || []).map((b) => b.type).filter(Boolean),
        deps,
        status,
        baseRef: baseRef || "current",
        linesChanged: status === "customized" ? lineDiff(atVersion ?? current, text) : 0,
        baseUpdated: atVersion != null && current != null && normalise(atVersion) !== normalise(current),
        notes: previous?.notes || "",
        screenshot: previous?.screenshot || null,
        scannedAt: new Date().toISOString(),
      };
    });

  index.entries = index.entries.filter((e) => e.project !== folder).concat(entries);
  for (const file of ccFiles) {
    const target = join(libraryDir, storeSlug, file);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(folder, file), target);
  }
  return entries;
}

function collectDeps(folder, file, seen) {
  const path = join(folder, file);
  if (!existsSync(path) || /\.(css|js)$/.test(file)) return seen;
  const text = readFileSync(path, "utf8");
  const found = new Set();
  for (const m of text.matchAll(/\{%-?\s*render\s+['"](cc-[\w-]+)['"]/g)) found.add(`snippets/${m[1]}.liquid`);
  for (const m of text.matchAll(/content_for\s+['"]block['"]\s*,\s*type:\s*['"](cc-[\w-]+)['"]/g)) found.add(`blocks/${m[1]}.liquid`);
  for (const m of text.matchAll(/['"](cc-[\w.-]+\.(?:css|js))['"]\s*\|\s*asset_url/g)) found.add(`assets/${m[1]}`);
  for (const b of parseSchema(text)?.blocks || []) if (/^cc-/.test(b.type || "")) found.add(`blocks/${b.type}.liquid`);
  for (const dep of found) {
    if (seen.has(dep) || !existsSync(join(folder, dep))) continue;
    seen.add(dep);
    collectDeps(folder, dep, seen);
  }
  return seen;
}

// ---------- base theme ----------

function baseFor(folder) {
  const own = (readJson(join(folder, ".twin-dev.json")) || {}).baseTheme;
  const root = args.base
    || (own && existsSync(own) ? own : null)
    || process.env.TWIN_DEV_BASE_THEME
    || readConfig().baseTheme
    || baseClone();
  const key = root ? resolve(root) : "";
  if (!bases.has(key)) bases.set(key, openBase(key));
  return bases.get(key);
}

// The managed base theme clone, cloned once if it's missing. Null if cloning fails.
function baseClone() {
  if (existsSync(join(BASE_THEME_CLONE, ".git"))) return BASE_THEME_CLONE;
  if (cloneFailed) return null;
  const repo = readConfig().baseThemeRepo || BASE_THEME_REPO;
  console.error(`Cloning the base theme from ${repo} into ${BASE_THEME_CLONE}`);
  try {
    execFileSync("git", ["clone", repo, BASE_THEME_CLONE], { stdio: ["ignore", 2, 2] });
    return BASE_THEME_CLONE;
  } catch {
    rmSync(BASE_THEME_CLONE, { recursive: true, force: true });
    cloneFailed = true;
    return null;
  }
}

function openBase(root) {
  const none = { refFor: () => null, read: () => null };
  if (!root || !existsSync(join(root, "config", "settings_schema.json"))) {
    console.error(`No base theme (pass --base, set TWIN_DEV_BASE_THEME, or add {"baseTheme": "<path>"} to ${CONFIG_PATH}): every cc- file will be marked custom.`);
    return none;
  }
  const isGit = tryGit(root, ["rev-parse", "--is-inside-work-tree"]) === "true";
  const versionCommits = new Map();
  if (isGit) {
    const commits = (tryGit(root, ["log", "--format=%H", "--", "config/settings_schema.json"]) || "").split("\n").filter(Boolean);
    for (const hash of commits) {
      const text = tryGit(root, ["show", `${hash}:config/settings_schema.json`]);
      const version = text && versionFrom(text);
      if (version && !versionCommits.has(version)) versionCommits.set(version, hash);
    }
  }
  return {
    refFor(baseCommit, version) {
      if (!isGit) return null;
      if (baseCommit && tryGit(root, ["cat-file", "-e", `${baseCommit}^{commit}`]) !== null) return baseCommit;
      return versionCommits.get(version) || null;
    },
    read(ref, file) {
      if (ref) return tryGit(root, ["show", `${ref}:${file}`]);
      const p = join(root, file);
      return existsSync(p) ? readFileSync(p, "utf8") : null;
    },
  };
}

function tryGit(cwd, argv) {
  try {
    return execFileSync("git", argv, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch {
    return null;
  }
}

// ---------- search ----------

function score(entry, terms) {
  const fields = [
    [entry.file, 5],
    [entry.name, 5],
    [entry.presets.join(" "), 4],
    [entry.notes, 4],
    [entry.blocks.join(" "), 2],
    [entry.settings.join(" "), 1],
    [`${entry.storeName} ${entry.store || ""}`, 2],
  ].map(([text, weight]) => [tokens(text || ""), weight]);
  let total = 0;
  for (const term of terms) {
    for (const [toks, weight] of fields) {
      if (toks.includes(term)) total += weight * 2;
      else if (toks.some((t) => t.startsWith(term) || term.startsWith(t) && t.length > 3)) total += weight;
    }
  }
  return total;
}

function summary(e) {
  return {
    id: e.id,
    name: e.name,
    kind: e.kind,
    status: e.status,
    horizonVersion: e.horizonVersion,
    baseRef: e.baseRef,
    linesChanged: e.linesChanged,
    baseUpdated: e.baseUpdated,
    deps: e.deps,
    notes: e.notes,
    screenshot: e.screenshot,
    project: e.project,
  };
}

function findEntry(index, id) {
  if (!id) fail("Pass an entry id (from search).", 2);
  const entry = index.entries.find((e) => e.id === id);
  if (!entry) fail(`No entry ${id}. Search first to get the id.`);
  return entry;
}

// ---------- index files ----------

function loadIndex() {
  return readJson(indexPath) || { entries: [] };
}

function saveIndex(index) {
  mkdirSync(libraryDir, { recursive: true });
  index.entries.sort((a, b) => a.file.localeCompare(b.file) || compareVersions(b.horizonVersion, a.horizonVersion));
  index.updatedAt = new Date().toISOString();
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
  const rows = index.entries.map(
    (e) => `| \`${e.file}\` | ${e.name || ""} | ${e.storeName} | ${e.horizonVersion} | ${e.status}${e.linesChanged ? ` (${e.linesChanged} lines)` : ""} | ${(e.notes || "").replace(/\|/g, "/").replace(/\n/g, " ")} |`,
  );
  writeFileSync(
    join(libraryDir, "index.md"),
    `# twin-dev section library\n\nGenerated by library.mjs, ${index.updatedAt}. Edit notes with \`library.mjs note\`, not here.\n\n| File | Name | Store | Horizon | Status | Notes |\n|---|---|---|---|---|---|\n${rows.join("\n")}\n`,
  );
}

// ---------- helpers ----------

function isTheme(folder) {
  return existsSync(join(folder, "config", "settings_schema.json"));
}

function listCc(folder, dir) {
  const path = join(folder, dir);
  if (!existsSync(path)) return [];
  return readdirSync(path).filter((f) => /^cc-/.test(f)).map((f) => `${dir}/${f}`);
}

function parseSchema(text) {
  const m = text.match(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function label(value, locale) {
  if (!value) return "";
  if (typeof value === "object") return value.en || Object.values(value)[0] || "";
  if (!value.startsWith("t:")) return value;
  const found = value.slice(2).split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), locale);
  return typeof found === "string" ? found : value;
}

function readThemeVersion(path) {
  return versionFrom(readFileSync(path, "utf8")) || "unknown";
}

function versionFrom(text) {
  let schema;
  try {
    schema = JSON.parse(text);
  } catch {
    try {
      schema = JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, ""));
    } catch {
      return null;
    }
  }
  const info = Array.isArray(schema) ? schema.find((e) => e.name === "theme_info") : null;
  return info?.theme_version ? String(info.theme_version).trim() : null;
}

function normalise(text) {
  return (text || "").replace(/\r\n/g, "\n").trim();
}

// Lines added + removed (LCS), so "customized" shows how far a copy drifted.
function lineDiff(a, b) {
  const x = normalise(a).split("\n");
  const y = normalise(b).split("\n");
  if (x.length * y.length > 4_000_000) return Math.abs(x.length - y.length) || -1;
  let prev = new Array(y.length + 1).fill(0);
  for (let i = 1; i <= x.length; i++) {
    const row = new Array(y.length + 1).fill(0);
    for (let j = 1; j <= y.length; j++) row[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
    prev = row;
  }
  return x.length + y.length - 2 * prev[y.length];
}

function tokens(text) {
  return String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1 && t !== "cc");
}

function compareVersions(a = "", b = "") {
  const pa = String(a).split(".").map(Number);
  const pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

function slug(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const out = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) out[argv[i].slice(2)] = argv[++i];
    else positional.push(argv[i]);
  }
  return { args: out, words: positional };
}

// --flag, then $TWIN_DEV_PROJECTS_DIR, then `projectsDir` in ~/.claude/twin-dev/config.json.
function resolveProjectsDir(flag) {
  const dir = flag || process.env.TWIN_DEV_PROJECTS_DIR || readConfig().projectsDir;
  if (!dir) fail(`No projects folder. Pass --projects <dir>, set TWIN_DEV_PROJECTS_DIR, or add {"projectsDir": "<dir>"} to ${CONFIG_PATH}.`, 2);
  return resolve(dir);
}

function readConfig() {
  return existsSync(CONFIG_PATH) ? JSON.parse(readFileSync(CONFIG_PATH, "utf8")) : {};
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}
