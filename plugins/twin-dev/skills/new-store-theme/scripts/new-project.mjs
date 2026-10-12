#!/usr/bin/env node
// Create a new store project folder from the local base Horizon theme.
//
// Usage:
//   node new-project.mjs --store "<Store name>" [--base <path>] [--dest <dir>]
//                        [--short <abbr>] [--domain <store>.myshopify.com]
//                        [--figma <figma.com link>] [--dry-run]
//
//   --store    Store / brand name as the client writes it (required)
//   --base     Base theme folder. Defaults to $TWIN_DEV_BASE_THEME.
//   --dest     Parent directory for the new folder. Defaults to $TWIN_DEV_PROJECTS_DIR,
//              then the Capital Commerce Projects folder (DEFAULT_PROJECTS_DIR).
//   --short    Abbreviation to use when the full theme name is over 50 characters.
//              Defaults to the store name's initials.
//   --domain   The store's <store>.myshopify.com domain, saved as `store`.
//   --figma    The store's Figma design link, saved as `figmaUrl`.
//   --dry-run  Print the plan without copying anything.
//
// Writes .twin-dev.json (this store's details: store, themeId, figmaUrl, ...)
// into the new folder.
// Prints JSON: { storeName, version, themeName, folderName, folderPath, baseTheme, store, figmaUrl }.
// Exits 1 if the base theme is invalid, the name can't fit, or the folder exists.

import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const MAX_THEME_NAME = 50;
const SUFFIX = "(Momentum in progress...)";
const DEFAULT_PROJECTS_DIR = "D:/Lenmuel Del Rosario/Documents/Employer/Capital Commerce/Projects";
const SKIP = new Set([".git", "node_modules", ".shopify", ".DS_Store", "Thumbs.db", ".twin-dev.json"]);

const args = parseArgs(process.argv.slice(2));
const storeName = (args.store || "").trim();
if (!storeName) fail('Pass --store "<Store name>".', 2);

const base = args.base || process.env.TWIN_DEV_BASE_THEME;
if (!base) fail("Pass --base <path> or set TWIN_DEV_BASE_THEME to the base theme folder.", 2);
const baseTheme = resolve(base);

const schemaPath = join(baseTheme, "config", "settings_schema.json");
if (!existsSync(schemaPath)) fail(`Not a theme folder (missing config/settings_schema.json): ${baseTheme}`);
const version = readThemeVersion(schemaPath);

const themeName = buildThemeName(storeName, version, args.short);
const folderName = `${safeFolderName(storeName)} x Horizon ${version}`;
const projectsDir = resolve(args.dest || process.env.TWIN_DEV_PROJECTS_DIR || DEFAULT_PROJECTS_DIR);
if (!existsSync(projectsDir)) fail(`Projects folder doesn't exist: ${projectsDir}`);
const folderPath = join(projectsDir, folderName);
if (existsSync(folderPath)) fail(`Folder already exists: ${folderPath}`);

const store = normaliseDomain(args.domain);
const figmaUrl = (args.figma || "").trim() || null;
if (figmaUrl && !/^https:\/\/(www\.)?figma\.com\//.test(figmaUrl)) fail(`Not a Figma link: ${figmaUrl}`, 2);

const plan = { storeName, version, themeName, folderName, folderPath, baseTheme, store, figmaUrl };

if (!args["dry-run"]) {
  cpSync(baseTheme, folderPath, {
    recursive: true,
    filter: (src) => !SKIP.has(basename(src)),
  });
  writeFileSync(
    join(folderPath, ".twin-dev.json"),
    JSON.stringify({ ...plan, createdAt: new Date().toISOString(), themeId: null }, null, 2) + "\n",
  );
}

console.log(JSON.stringify({ dryRun: Boolean(args["dry-run"]), ...plan }, null, 2));

function buildThemeName(name, ver, short) {
  const make = (label) => `${label} x Hv${ver}${SUFFIX}`;
  const full = make(name);
  if (full.length <= MAX_THEME_NAME) return full;
  const abbreviated = make(short || initials(name));
  if (abbreviated.length <= MAX_THEME_NAME) return abbreviated;
  fail(`Theme name is ${abbreviated.length} characters, over ${MAX_THEME_NAME}: "${abbreviated}". Pass a shorter --short.`);
}

function normaliseDomain(value) {
  const domain = (value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!domain) return null;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain)) fail(`Pass the <store>.myshopify.com domain, not: ${value}`, 2);
  return domain;
}

function initials(name) {
  return name
    .split(/[\s\-_/]+/)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] || "")
    .join("")
    .toUpperCase();
}

// Keep the store name as written, minus characters Windows doesn't allow in folder names.
function safeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/, "");
}

function readThemeVersion(path) {
  const text = readFileSync(path, "utf8");
  let schema;
  try {
    schema = JSON.parse(text);
  } catch {
    schema = JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, ""));
  }
  const info = Array.isArray(schema) ? schema.find((entry) => entry.name === "theme_info") : null;
  if (!info?.theme_version) fail(`No theme_info.theme_version in ${path}`);
  return String(info.theme_version).trim();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, "");
    if (key === "dry-run") out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}
