#!/usr/bin/env node
// Print what a Shopify theme can build with, read from its own files: sections
// (presets, allowed blocks, settings), theme blocks, and what each template and
// section group currently contains. Run it in each store project, because every
// store's theme ends up with different sections and layouts.
//
// Usage:
//   node theme-inventory.mjs [--theme <dir>] [--settings] [--detail <type>[,<type>...]] [--json]
//
//   --theme     Theme root. Defaults to the current directory.
//   --settings  Add each section's and block's setting IDs to the tables.
//   --detail  Full settings (type, range, options, default) and preset block trees
//             for these section or block types, e.g. --detail hero,_cc-card.
//   --json    Print everything as JSON instead of Markdown.
//
// Exits 1 if the folder isn't a theme (no sections/ or config/settings_schema.json).

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = resolve(args.theme || ".");
if (!existsSync(join(root, "sections")) || !existsSync(join(root, "config", "settings_schema.json"))) {
  fail(`${root} doesn't look like a theme (needs sections/ and config/settings_schema.json).`);
}

const t = loadTranslations();
const version = themeVersion();
const sections = readSchemas("sections");
const blocks = readSchemas("blocks");
const templates = readLayouts("templates");
const groups = readLayouts("sections", (f) => f.endsWith(".json"));
const detail = new Set((args.detail || "").split(",").map((s) => s.trim()).filter(Boolean));

if (args.json) {
  console.log(JSON.stringify({ root, version, sections, blocks, templates, groups }, null, 2));
  process.exit(0);
}

const out = [];
out.push(`# Theme inventory: ${basename(root)}${version ? ` (v${version})` : ""}`, "");
out.push("Custom (`cc-`) files are marked ★. Use --settings for setting IDs, --detail <type> for ranges and options.", "");
const withSettings = !!args.settings;

out.push("## Sections", "");
out.push(`| Section | Name | Presets | Allowed blocks | Group-only |${withSettings ? " Settings |" : ""}`, `|---|---|---|---|---|${withSettings ? "---|" : ""}`);
for (const s of sections) {
  out.push(row([
    mark(s.type),
    s.name,
    s.presets.map((p) => p.name).join(", ") || "—",
    s.blocks.join(", ") || "—",
    s.enabledOn || "",
    ...(withSettings ? [s.settings.map((x) => x.id).join(", ")] : []),
  ]));
}
out.push("");

out.push("## Theme blocks", "");
out.push("Blocks starting with `_` are internal: only usable where a parent lists them.", "");
out.push(`| Block | Name | Child blocks |${withSettings ? " Settings |" : ""}`, `|---|---|---|${withSettings ? "---|" : ""}`);
for (const b of blocks) {
  out.push(row([mark(b.type), b.name, b.blocks.join(", ") || "—", ...(withSettings ? [b.settings.map((x) => x.id).join(", ")] : [])]));
}
out.push("");

out.push("## Current layouts", "");
out.push("What each template and section group holds now, top to bottom. Block trees show types.", "");
for (const l of [...groups, ...templates]) {
  out.push(`### ${l.file}`, "");
  if (l.error) {
    out.push(`Couldn't parse: ${l.error}`, "");
    continue;
  }
  if (!l.sections.length) out.push("(no sections)");
  for (const s of l.sections) {
    out.push(`- \`${s.id}\` → **${s.type}**${s.disabled ? " (disabled)" : ""}${s.blocks ? `: ${s.blocks}` : ""}`);
  }
  out.push("");
}

for (const type of detail) {
  const item = sections.find((s) => s.type === type) || blocks.find((b) => b.type === type);
  out.push(`## Detail: ${type}`, "");
  if (!item) {
    out.push("Not found.", "");
    continue;
  }
  out.push("| Setting | Type | Range / options | Default | Label |", "|---|---|---|---|---|");
  for (const x of item.settings) {
    out.push(row([x.id, x.type, x.range || x.options || "", x.default ?? "", x.label || ""]));
  }
  out.push("");
  for (const p of item.presets || []) {
    out.push(`Preset **${p.name}**: ${p.blocks || "(no blocks)"}`, "");
  }
}

console.log(out.join("\n"));

// --- readers ---------------------------------------------------------------

function readSchemas(dir) {
  const path = join(root, dir);
  if (!existsSync(path)) return [];
  const items = [];
  for (const file of readdirSync(path).filter((f) => f.endsWith(".liquid")).sort()) {
    const src = readFileSync(join(path, file), "utf8");
    const m = src.match(/{%-?\s*schema\s*-?%}([\s\S]*?){%-?\s*endschema\s*-?%}/);
    if (!m) continue;
    let schema;
    try {
      schema = JSON.parse(m[1]);
    } catch (e) {
      items.push({ type: file.replace(/\.liquid$/, ""), name: `(invalid schema: ${e.message})`, presets: [], blocks: [], settings: [] });
      continue;
    }
    items.push({
      type: file.replace(/\.liquid$/, ""),
      name: tr(schema.name),
      enabledOn: schema.enabled_on?.groups?.join(", ") || "",
      blocks: (schema.blocks || []).map((b) => b.type).filter(Boolean),
      presets: (schema.presets || []).map((p) => ({ name: tr(p.name), blocks: tree(p.blocks, p.block_order) })),
      settings: (schema.settings || []).filter((x) => x.id).map(setting),
    });
  }
  return items;
}

function readLayouts(dir, filter = (f) => f.endsWith(".json")) {
  const path = join(root, dir);
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter(filter)
    .sort()
    .map((file) => {
      const rel = `${dir}/${file}`;
      try {
        const data = parseJson(readFileSync(join(path, file), "utf8"));
        const order = data.order || Object.keys(data.sections || {});
        return {
          file: rel,
          sections: order
            .filter((id) => data.sections?.[id])
            .map((id) => {
              const s = data.sections[id];
              return { id, type: s.type, disabled: !!s.disabled, blocks: tree(s.blocks, s.block_order) };
            }),
        };
      } catch (e) {
        return { file: rel, error: e.message, sections: [] };
      }
    });
}

// Block tree as text: "text, group[icon, text] ×3"
function tree(blocksObj, order) {
  if (!blocksObj) return "";
  const list = Array.isArray(blocksObj) ? blocksObj : (order || Object.keys(blocksObj)).map((id) => blocksObj[id]).filter(Boolean);
  const parts = list.map((b) => {
    const inner = tree(b.blocks, b.block_order);
    return `${b.type}${b.static ? " (static)" : ""}${inner ? `[${inner}]` : ""}`;
  });
  const grouped = [];
  for (const p of parts) {
    const last = grouped[grouped.length - 1];
    if (last && last.text === p) last.n++;
    else grouped.push({ text: p, n: 1 });
  }
  return grouped.map((g) => (g.n > 1 ? `${g.text} ×${g.n}` : g.text)).join(", ");
}

function setting(x) {
  const s = { id: x.id, type: x.type, label: tr(x.label) };
  if ("min" in x || "max" in x) s.range = `${x.min ?? ""}–${x.max ?? ""}${x.step && x.step !== 1 ? ` step ${x.step}` : ""}${x.unit ? ` ${x.unit}` : ""}`;
  if (x.options) s.options = x.options.map((o) => o.value).join(" / ");
  if ("default" in x) s.default = typeof x.default === "object" ? JSON.stringify(x.default) : String(x.default);
  return s;
}

// --- helpers ---------------------------------------------------------------

function loadTranslations() {
  const file = join(root, "locales", "en.default.schema.json");
  try {
    return parseJson(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function tr(value) {
  if (typeof value !== "string" || !value.startsWith("t:")) return value ?? "";
  const found = value
    .slice(2)
    .split(".")
    .reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), t);
  return typeof found === "string" ? found : value;
}

function themeVersion() {
  try {
    const schema = parseJson(readFileSync(join(root, "config", "settings_schema.json"), "utf8"));
    return schema.find((s) => s.name === "theme_info")?.theme_version || "";
  } catch {
    return "";
  }
}

// Shopify JSON files may have a BOM, /* */ and // comments, and trailing commas.
function parseJson(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      out += c;
      if (c === "\\") out += text[++i] ?? "";
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      out += c;
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/^﻿/, "").replace(/,(\s*[}\]])/g, "$1"));
}

function mark(type) {
  return `\`${type}\`${/^_?cc-/.test(type) ? " ★" : ""}`;
}

function row(cells) {
  return `| ${cells.map((c) => String(c).replace(/\|/g, "\\|").replace(/\n/g, " ")).join(" | ")} |`;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else out[key] = argv[++i];
  }
  return out;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
