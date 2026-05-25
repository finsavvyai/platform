import type { Env } from "./types";
import type { Context } from "hono";

interface StatusConfig {
  label: string;
  color: string;
}

const STATUS_MAP: Record<string, StatusConfig> = {
  passed: { label: "passing", color: "#4c1" },
  failed: { label: "failing", color: "#e05d44" },
  running: { label: "running", color: "#dfb317" },
  pending: { label: "running", color: "#dfb317" },
};

const DEFAULT_STATUS: StatusConfig = { label: "unknown", color: "#9f9f9f" };

function makeBadgeSvg(status: StatusConfig): string {
  const leftText = "PushCI";
  const rightText = status.label;
  const leftWidth = 52;
  const rightWidth = rightText.length * 7 + 12;
  const totalWidth = leftWidth + rightWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="a">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#a)">
    <rect width="${leftWidth}" height="20" fill="#555"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${status.color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="${leftWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${leftText}</text>
    <text x="${leftWidth / 2}" y="14">${leftText}</text>
    <text x="${leftWidth + rightWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${rightText}</text>
    <text x="${leftWidth + rightWidth / 2}" y="14">${rightText}</text>
  </g>
</svg>`;
}

export async function handleBadge(
  c: Context<{ Bindings: Env }>
): Promise<Response> {
  const owner = c.req.param("owner");
  const repo = c.req.param("repo");
  const fullRepo = `${owner}/${repo}`;

  const row = await c.env.DB.prepare(
    "SELECT status FROM runs WHERE repo = ? ORDER BY started_at DESC LIMIT 1"
  )
    .bind(fullRepo)
    .first<{ status: string }>();

  const config = row ? STATUS_MAP[row.status] ?? DEFAULT_STATUS : DEFAULT_STATUS;
  const svg = makeBadgeSvg(config);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "max-age=300",
    },
  });
}
