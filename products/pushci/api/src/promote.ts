// Promote API — auto-submit PushCI to AI registries and search engines.

import { Hono } from "hono";
import type { Env } from "./types";

const SITEMAP = "https://pushci.dev/sitemap.xml";
const INDEX_URLS = [
  "https://pushci.dev/", "https://pushci.dev/why",
  "https://pushci.dev/ai", "https://pushci.dev/vs/github-actions",
  "https://pushci.dev/llms.txt", "https://pushci.dev/llms-full.txt",
];
const AI_ENDPOINTS = [
  "https://pushci.dev/llms.txt",
  "https://pushci.dev/.well-known/ai-plugin.json",
  "https://pushci.dev/.well-known/mcp.json",
  "https://pushci.dev/openapi.json",
];
const MCP_REGISTRIES = [
  { name: "Smithery", api: "https://registry.smithery.ai/api/packages", web: "https://smithery.ai/submit" },
  { name: "mcp.so", api: "https://mcp.so/api/submit", web: "https://mcp.so/submit" },
  { name: "Glama", api: "https://glama.ai/api/mcp/packages", web: "https://glama.ai/mcp/submit" },
];

const mcpPayload = {
  name: "pushci", command: "pushci", args: ["mcp"],
  install: "npm install -g pushci",
  repository: "https://github.com/finsavvyai/pushci",
  homepage: "https://pushci.dev",
  description: "AI-native zero-config CI/CD. 19 languages, 40+ frameworks. Free forever.",
};

export const promoteRoutes = new Hono<{ Bindings: Env }>();

promoteRoutes.post("/promote", async (c) => {
  const results: Record<string, unknown>[] = [];

  // Search engines
  for (const [name, url] of [["Google", `https://www.google.com/ping?sitemap=${SITEMAP}`], ["Bing", `https://www.bing.com/ping?sitemap=${SITEMAP}`]]) {
    const ok = await fetch(url).then(() => true).catch(() => false);
    results.push({ name, status: ok ? "ok" : "error" });
  }

  // IndexNow
  await fetch("https://api.indexnow.org/indexnow", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host: "pushci.dev", key: "pushci-indexnow-key", urlList: INDEX_URLS }),
  }).catch(() => {});
  results.push({ name: "IndexNow", status: "ok" });

  // MCP registries
  for (const reg of MCP_REGISTRIES) {
    const resp = await fetch(reg.api, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mcpPayload),
    }).catch(() => null);
    const ok = resp && resp.status >= 200 && resp.status < 300;
    results.push({ name: reg.name, status: ok ? "ok" : "fallback", url: reg.web });
  }

  // Verify endpoints
  const verified: Record<string, string>[] = [];
  for (const url of AI_ENDPOINTS) {
    const resp = await fetch(url).catch(() => null);
    verified.push({ url, status: resp?.ok ? "ok" : "error" });
  }

  return c.json({ results, verified, promoted_at: new Date().toISOString() });
});
