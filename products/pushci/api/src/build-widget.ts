// Embeddable Build Widget — SVG badge with build number + status.

import { Hono } from "hono";
import type { Env } from "./types";

export const widgetRoutes = new Hono<{ Bindings: Env }>();

const COLORS: Record<string, string> = {
  passed: "#10b981", failed: "#ef4444", running: "#f59e0b",
  pending: "#f59e0b", unknown: "#6b7280",
};

// SVG badge: "PushCI | Build #42 | passing"
widgetRoutes.get("/widget/:owner/:repo", async (c) => {
  const repo = `${c.req.param("owner")}/${c.req.param("repo")}`;
  const project = await c.env.DB.prepare(
    "SELECT build_number FROM projects WHERE repo = ?"
  ).bind(repo).first<{ build_number: number }>();
  const run = await c.env.DB.prepare(
    "SELECT status FROM runs WHERE repo = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(repo).first<{ status: string }>();

  const num = project?.build_number ?? 0;
  const status = run?.status ?? "unknown";
  const label = status === "passed" ? "passing" : status === "failed" ? "failing" : status;
  const color = COLORS[status] || COLORS.unknown;

  const svg = buildWidgetSvg(num, label, color);
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "max-age=60" },
  });
});

// HTML snippet endpoint — returns copy-paste embed code
widgetRoutes.get("/widget/:owner/:repo/embed", async (c) => {
  const owner = c.req.param("owner");
  const repo = c.req.param("repo");
  const full = `${owner}/${repo}`;
  const format = c.req.query("format") || "html";

  const badgeUrl = `https://api.pushci.dev/widget/${full}`;
  const linkUrl = `https://app.pushci.dev`;

  if (format === "markdown") {
    return c.text(`[![PushCI](${badgeUrl})](${linkUrl})`);
  }
  if (format === "react") {
    return c.text(
      `<a href="${linkUrl}" target="_blank" rel="noopener">\n` +
      `  <img src="${badgeUrl}" alt="PushCI Build Status" />\n</a>`
    );
  }
  return c.text(
    `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">\n` +
    `  <img src="${badgeUrl}" alt="PushCI Build Status" height="20" />\n</a>`
  );
});

function buildWidgetSvg(buildNum: number, status: string, color: string): string {
  const left = "PushCI";
  const mid = `#${buildNum}`;
  const right = status;
  const lw = 48, mw = mid.length * 7 + 12, rw = right.length * 7 + 12;
  const tw = lw + mw + rw;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="20">
<linearGradient id="b" x2="0" y2="100%">
  <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
  <stop offset="1" stop-opacity=".1"/>
</linearGradient>
<clipPath id="a"><rect width="${tw}" height="20" rx="3"/></clipPath>
<g clip-path="url(#a)">
  <rect width="${lw}" height="20" fill="#18181b"/>
  <rect x="${lw}" width="${mw}" height="20" fill="#27272a"/>
  <rect x="${lw + mw}" width="${rw}" height="20" fill="${color}"/>
  <rect width="${tw}" height="20" fill="url(#b)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11">
  <text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${left}</text>
  <text x="${lw / 2}" y="14">${left}</text>
  <text x="${lw + mw / 2}" y="15" fill="#010101" fill-opacity=".3">${mid}</text>
  <text x="${lw + mw / 2}" y="14">${mid}</text>
  <text x="${lw + mw + rw / 2}" y="15" fill="#010101" fill-opacity=".3">${right}</text>
  <text x="${lw + mw + rw / 2}" y="14">${right}</text>
</g>
</svg>`;
}
