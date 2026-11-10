#!/usr/bin/env node
// Finds tokens, API keys, passwords and private links before they reach git,
// the section library or a skill. It never prints a secret: findings show the
// file, line, rule and the first 4 characters only.
//
// Usage:
//   node secret-scan.mjs                 scan tracked + untracked (not ignored) files in the git repo
//   node secret-scan.mjs --staged        scan only what is staged (use in pre-commit)
//   node secret-scan.mjs <path> [...]    scan these files or folders
//
// Exit codes: 0 clean, 1 findings, 2 usage error.
//
// A line that is a deliberate example can end with:  secret-scan: allow
//
// Also importable: import { findSecrets, forbiddenFile } from "./secret-scan.mjs"

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RULES = [
  { id: "shopify-token", re: /\bshp(?:at|ca|ss|pa|ua|tka)_[A-Za-z0-9]{24,}/ },
  { id: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { id: "openai-key", re: /\bsk-[A-Za-z0-9]{32,}/ },
  { id: "figma-token", re: /\bfigd_[A-Za-z0-9_-]{20,}/ },
  { id: "github-token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/ },
  { id: "slack-token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { id: "aws-key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: "google-key", re: /\bAIza[0-9A-Za-z_-]{35}/ },
  { id: "stripe-key", re: /\b[sr]k_live_[A-Za-z0-9]{20,}/ },
  { id: "private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: "bearer-token", re: /\bAuthorization["']?\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9._~+/-]{20,}/i },
  { id: "access-token-header", re: /X-Shopify-Access-Token["']?\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/i },
  { id: "env-secret-value", re: /\b(?:SHOPIFY_(?:ADMIN_TOKEN|CLIENT_ID|CLIENT_SECRET)|FIGMA_(?:ACCESS_)?TOKEN|[A-Z_]*(?:API_KEY|SECRET|PASSWORD))\s*=\s*["']?[A-Za-z0-9_./+-]{12,}/ },
  { id: "url-secret", re: /[?&](?:key|preview_key|access_token|api_key|apikey|token|password)=[A-Za-z0-9_-]{16,}/i },
  { id: "url-credentials", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]{4,}@/i },
  { id: "assigned-secret", re: /\b(?:token|secret|api[_-]?key|password|passwd|client[_-]?secret)["']?\s*[:=]\s*["'][^"'\s]{16,}["']/i },
];

// A match with one of these in it is a placeholder, not a secret.
const PLACEHOLDER = /<[^>]*>|\.\.\.|\$\{|\$[A-Z_]+|\{\{|process\.env|xxxx|your[_-]|example|placeholder|redacted|changeme/i;

// Files that hold secrets by nature: never committed, never copied into the library.
const FORBIDDEN = [
  /(^|\/)\.env(\..+)?$/,
  /\.(pem|key|p12|pfx)$/i,
  /(^|\/)\.twin-dev\.json$/,
  /(^|\/)shopify\.theme\.toml$/,
  /(^|\/)\.shopify\//,
  /(^|\/)failures\.md$/,
  /(^|\/)settings\.local\.json$/,
  /\.har$/i,
];

export function forbiddenFile(path) {
  const p = path.replace(/\\/g, "/");
  return FORBIDDEN.some((re) => re.test(p));
}

export function findSecrets(text) {
  const found = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (/secret-scan:\s*allow/.test(line)) return;
    for (const rule of RULES) {
      const m = line.match(rule.re);
      if (!m || PLACEHOLDER.test(m[0])) continue;
      found.push({ line: i + 1, rule: rule.id, preview: `${m[0].replace(/^\W+/, "").slice(0, 4)}***` });
      break;
    }
  });
  return found;
}

const SKIP_DIRS = new Set([".git", "node_modules", ".playwright-mcp"]);
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|pdf|zip|gz|mp4|webm|mov)$/i;

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter(Boolean);
}

function walk(path, out = []) {
  const stat = statSync(path);
  if (stat.isFile()) return out.push(path), out;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (!SKIP_DIRS.has(entry.name)) walk(join(path, entry.name), out);
  }
  return out;
}

function filesToScan(args) {
  const staged = args.includes("--staged");
  const paths = args.filter((a) => !a.startsWith("--"));
  if (paths.length) return { root: process.cwd(), files: paths.flatMap((p) => walk(resolve(p))) };
  const root = git(["rev-parse", "--show-toplevel"], process.cwd())[0];
  const names = staged
    ? git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"], root)
    : [...git(["ls-files"], root), ...git(["ls-files", "--others", "--exclude-standard"], root)];
  return { root, files: names.map((n) => join(root, n)) };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.error("Usage: node secret-scan.mjs [--staged] [path ...]");
    process.exit(2);
  }
  let target;
  try {
    target = filesToScan(args);
  } catch (err) {
    console.error(`Could not list files: ${err.message.split("\n")[0]}`);
    process.exit(2);
  }

  const problems = [];
  for (const file of new Set(target.files)) {
    const name = relative(target.root, file).replace(/\\/g, "/");
    if (forbiddenFile(name)) {
      problems.push(`${name}: file type that holds secrets; keep it out of the repo (add it to .gitignore)`);
      continue;
    }
    if (BINARY.test(file)) continue;
    let text;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const f of findSecrets(text)) problems.push(`${name}:${f.line}: ${f.rule} (${f.preview})`);
  }

  if (problems.length) {
    console.error("Possible secrets found. Nothing was printed in full:\n");
    for (const p of problems) console.error(`  ${p}`);
    console.error("\nRemove the value (refer to it by variable name), rotate it if it was ever pushed or shared, then re-run.");
    console.error("A deliberate example can end its line with: secret-scan: allow");
    process.exit(1);
  }
  console.log(`No secrets found in ${new Set(target.files).size} files.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
