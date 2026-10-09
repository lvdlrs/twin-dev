#!/usr/bin/env node
// Fallback for when `shopify store execute` is unavailable.
// Run one Admin GraphQL request against a Shopify store and print the JSON result.
//
// Usage:
//   node admin-graphql.mjs <query.graphql> [variables.json]
//
// Environment:
//   SHOPIFY_STORE          store subdomain or <store>.myshopify.com (required)
//   SHOPIFY_ADMIN_TOKEN    Admin API access token (shpat_...), or
//   SHOPIFY_CLIENT_ID +
//   SHOPIFY_CLIENT_SECRET  Dev Dashboard app credentials; a token is fetched with
//                          the client credentials grant
//   SHOPIFY_API_VERSION    defaults to 2026-10
//
// Exits 1 on HTTP errors, GraphQL errors or mutation userErrors.

import { readFileSync } from "node:fs";

const [queryPath, variablesPath] = process.argv.slice(2);
if (!queryPath) {
  console.error("Usage: node admin-graphql.mjs <query.graphql> [variables.json]");
  process.exit(2);
}

const store = (process.env.SHOPIFY_STORE || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
if (!store) {
  console.error("Set SHOPIFY_STORE to the store subdomain or <store>.myshopify.com.");
  process.exit(2);
}
const shop = store.endsWith(".myshopify.com") ? store : `${store}.myshopify.com`;
const apiVersion = process.env.SHOPIFY_API_VERSION || "2026-10";

async function getToken() {
  if (process.env.SHOPIFY_ADMIN_TOKEN) return process.env.SHOPIFY_ADMIN_TOKEN;
  const { SHOPIFY_CLIENT_ID: clientId, SHOPIFY_CLIENT_SECRET: clientSecret } = process.env;
  if (!clientId || !clientSecret) {
    console.error("Set SHOPIFY_ADMIN_TOKEN, or SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.");
    process.exit(2);
  }
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    console.error(`Token request failed: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  return (await res.json()).access_token;
}

const query = readFileSync(queryPath, "utf8");
const variables = variablesPath ? JSON.parse(readFileSync(variablesPath, "utf8")) : {};

const res = await fetch(`https://${shop}/admin/api/${apiVersion}/graphql.json`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": await getToken(),
  },
  body: JSON.stringify({ query, variables }),
});

const text = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${text}`);
  process.exit(1);
}

const body = JSON.parse(text);
console.log(JSON.stringify(body, null, 2));

const userErrors = Object.values(body.data || {}).flatMap((payload) => payload?.userErrors || []);
if (body.errors?.length || userErrors.length) process.exit(1);
