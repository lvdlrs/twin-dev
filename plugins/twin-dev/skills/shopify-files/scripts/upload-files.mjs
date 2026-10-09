#!/usr/bin/env node
// Upload local images to Shopify Files (Content > Files) with alt text.
//
// Usage:
//   node upload-files.mjs <manifest.json> --store <store>.myshopify.com [--dry-run]
//
// manifest.json:
//   [
//     { "file": "C:/path/hero-desktop.jpg", "filename": "hero-banner-desktop.jpg", "alt": "Woman pouring coffee" },
//     { "file": "C:/path/logo.svg", "alt": "Acme Coffee" }
//   ]
//   "filename" defaults to the file's own name. Use "alt": "" for decorative images.
//   Leave "alt" out to upload without alt text; those files are marked "needsAlt": true.
//
// Requests go through `shopify store execute` (run `shopify store auth` with
// read_files,write_files first). If SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID +
// SHOPIFY_CLIENT_SECRET, are set, the Admin API is called directly instead.
//
// Files that already exist with the same filename are skipped, not duplicated.
// Prints JSON: one entry per file with id, status, url and the theme reference
// (shopify://shop_images/<filename>). Exits 1 if any file failed.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-10";

const [manifestPath, ...rest] = process.argv.slice(2);
const storeIndex = rest.indexOf("--store");
const store = normaliseStore(storeIndex >= 0 ? rest[storeIndex + 1] : process.env.SHOPIFY_STORE);
const dryRun = rest.includes("--dry-run");
if (!manifestPath || !store) {
  console.error("Usage: node upload-files.mjs <manifest.json> --store <store>.myshopify.com [--dry-run]");
  process.exit(2);
}

const items = JSON.parse(readFileSync(manifestPath, "utf8")).map((entry) => {
  const file = resolve(entry.file);
  const filename = entry.filename || basename(file);
  const mimeType = MIME[extname(filename).toLowerCase()];
  if (!mimeType) fail(`Unsupported image type: ${filename}`);
  if (entry.alt !== undefined && typeof entry.alt !== "string") fail(`"alt" for ${filename} must be a string.`);
  const needsAlt = entry.alt === undefined;
  return { file, filename, alt: entry.alt ?? "", needsAlt, mimeType, fileSize: statSync(file).size };
});

const dupes = items.map((i) => i.filename).filter((name, i, all) => all.indexOf(name) !== i);
if (dupes.length) fail(`Duplicate filenames in manifest: ${[...new Set(dupes)].join(", ")}`);

const tmp = mkdtempSync(join(tmpdir(), "twin-dev-files-"));
const results = [];
try {
  const existing = await findExisting(items.map((i) => i.filename));
  const toUpload = [];
  for (const item of items) {
    const found = existing.get(item.filename);
    if (found) results.push({ filename: item.filename, status: "SKIPPED_EXISTS", id: found.id, url: found.url, alt: found.alt, themeRef: themeRef(item.filename) });
    else toUpload.push(item);
  }

  if (dryRun) {
    for (const item of toUpload) results.push({ filename: item.filename, status: "WOULD_UPLOAD", alt: item.alt, needsAlt: item.needsAlt || undefined, bytes: item.fileSize, themeRef: themeRef(item.filename) });
  } else if (toUpload.length) {
    results.push(...(await upload(toUpload)));
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(JSON.stringify({ store, dryRun, files: results }, null, 2));
if (results.some((r) => r.status === "FAILED")) process.exit(1);

async function upload(batch) {
  const staged = await graphql(
    `mutation Stage($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`,
    {
      input: batch.map((i) => ({
        filename: i.filename,
        mimeType: i.mimeType,
        fileSize: String(i.fileSize),
        resource: "IMAGE",
        httpMethod: "POST",
      })),
    },
    true,
  );
  checkUserErrors(staged.stagedUploadsCreate);
  const targets = staged.stagedUploadsCreate.stagedTargets;

  for (const [index, item] of batch.entries()) {
    const target = targets[index];
    const form = new FormData();
    for (const { name, value } of target.parameters) form.append(name, value);
    form.append("file", new Blob([readFileSync(item.file)], { type: item.mimeType }), item.filename);
    const res = await fetch(target.url, { method: "POST", body: form });
    if (!res.ok) fail(`Upload of ${item.filename} failed: HTTP ${res.status} ${await res.text()}`);
  }

  const created = await graphql(
    `mutation Create($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files { id fileStatus alt }
        userErrors { field message }
      }
    }`,
    {
      files: batch.map((item, index) => ({
        originalSource: targets[index].resourceUrl,
        contentType: "IMAGE",
        filename: item.filename,
        alt: item.alt,
        duplicateResolutionMode: "RAISE_ERROR",
      })),
    },
    true,
  );
  checkUserErrors(created.fileCreate);

  const ids = created.fileCreate.files.map((f) => f.id);
  const final = await waitUntilProcessed(ids);
  return batch.map((item, index) => {
    const node = final.get(ids[index]);
    return {
      filename: item.filename,
      status: node?.fileStatus === "READY" ? "UPLOADED" : "FAILED",
      id: ids[index],
      url: node?.image?.url || node?.url || null,
      alt: item.alt,
      needsAlt: item.needsAlt || undefined,
      errors: node?.fileErrors?.length ? node.fileErrors : undefined,
      themeRef: themeRef(item.filename),
    };
  });
}

async function waitUntilProcessed(ids) {
  let nodes = new Map();
  for (let attempt = 0; attempt < 20; attempt++) {
    const data = await graphql(
      `query Status($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on MediaImage { id fileStatus image { url } fileErrors { code message } }
          ... on GenericFile { id fileStatus url fileErrors { code message } }
        }
      }`,
      { ids },
    );
    nodes = new Map(data.nodes.filter(Boolean).map((n) => [n.id, n]));
    if ([...nodes.values()].every((n) => n.fileStatus === "READY" || n.fileStatus === "FAILED")) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return nodes;
}

async function findExisting(filenames) {
  const found = new Map();
  for (const filename of filenames) {
    const data = await graphql(
      `query Find($q: String!) {
        files(first: 5, query: $q) {
          nodes {
            id alt
            ... on MediaImage { image { url } }
            ... on GenericFile { url }
          }
        }
      }`,
      { q: `filename:'${filename.replace(/'/g, "\\'")}'` },
    );
    const match = data.files.nodes.find((n) => {
      const url = n.image?.url || n.url;
      if (!url) return false;
      return decodeURIComponent(basename(new URL(url).pathname)) === filename;
    });
    if (match) found.set(filename, { id: match.id, alt: match.alt, url: match.image?.url || match.url });
  }
  return found;
}

async function graphql(query, variables, mutation = false) {
  const body = useToken() ? await viaToken(query, variables) : viaCli(query, variables, mutation);
  if (body.errors?.length) fail(`GraphQL errors: ${JSON.stringify(body.errors)}`);
  return body.data ?? body;
}

function viaCli(query, variables, mutation) {
  const queryFile = join(tmp, "query.graphql");
  const varsFile = join(tmp, "variables.json");
  writeFileSync(queryFile, query);
  writeFileSync(varsFile, JSON.stringify(variables));
  const args = ["store", "execute", "--store", store, "--query-file", queryFile, "--variable-file", varsFile, "--json", "--no-input"];
  if (mutation) args.push("--allow-mutations");
  try {
    const out = execFileSync("shopify", args, { encoding: "utf8", shell: process.platform === "win32", maxBuffer: 32 * 1024 * 1024 });
    return JSON.parse(out.slice(out.indexOf("{")));
  } catch (error) {
    fail(`shopify store execute failed. Run "shopify store auth --store ${store} --scopes read_files,write_files" and retry.\n${error.stderr || error.message}`);
  }
}

function useToken() {
  return Boolean(process.env.SHOPIFY_ADMIN_TOKEN || (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET));
}

let cachedToken;
async function viaToken(query, variables) {
  cachedToken ??= process.env.SHOPIFY_ADMIN_TOKEN || (await clientCredentialsToken());
  const res = await fetch(`https://${store}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": cachedToken },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) fail(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function clientCredentialsToken() {
  const res = await fetch(`https://${store}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
    }),
  });
  if (!res.ok) fail(`Token request failed: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

function checkUserErrors(payload) {
  if (payload?.userErrors?.length) fail(`userErrors: ${JSON.stringify(payload.userErrors)}`);
}

function themeRef(filename) {
  return `shopify://shop_images/${filename}`;
}

function normaliseStore(value) {
  if (!value) return "";
  const host = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return host.endsWith(".myshopify.com") ? host : `${host}.myshopify.com`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
