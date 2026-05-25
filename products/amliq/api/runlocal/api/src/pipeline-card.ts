import type { Env } from "./types";
import type { Context } from "hono";

interface Job {
  name: string;
  status: string;
  duration_ms: number;
}

const STATUS_COLORS: Record<string, string> = {
  passed: "#34d399",
  failed: "#f87171",
  running: "#fbbf24",
  pending: "#a1a1aa",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function parseJobs(checksJson: string | null): Job[] {
  if (!checksJson) return [{ name: "build", status: "passed", duration_ms: 0 }];
  try {
    const parsed = JSON.parse(checksJson);
    if (Array.isArray(parsed)) return parsed;
    return [{ name: "build", status: "passed", duration_ms: 0 }];
  } catch {
    return [{ name: "build", status: "passed", duration_ms: 0 }];
  }
}

function renderPipelineCard(repo: string, jobs: Job[], totalMs: number): string {
  const jobWidth = 110;
  const arrowWidth = 30;
  const padding = 24;
  const contentWidth = jobs.length * jobWidth + (jobs.length - 1) * arrowWidth;
  const width = Math.max(contentWidth + padding * 2, 320);
  const height = 160;

  const jobsSvg = jobs.map((job, i) => {
    const x = padding + i * (jobWidth + arrowWidth);
    const color = STATUS_COLORS[job.status] ?? STATUS_COLORS.pending;
    const arrow = i < jobs.length - 1
      ? `<text x="${x + jobWidth + 5}" y="98" font-size="16" fill="#71717a">&#x2192;</text>`
      : "";
    return `<g>
      <rect x="${x}" y="72" width="${jobWidth}" height="44" rx="8" fill="#27272a" stroke="${color}" stroke-width="1.5"/>
      <circle cx="${x + 14}" cy="88" r="4" fill="${color}"/>
      <text x="${x + 22}" y="92" font-family="system-ui,sans-serif" font-size="11" fill="#e4e4e7">${job.name}</text>
      <text x="${x + 14}" y="108" font-family="system-ui,sans-serif" font-size="9" fill="#a1a1aa">${formatDuration(job.duration_ms)}</text>
      ${arrow}
    </g>`;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="12" fill="#18181b"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="11" fill="none" stroke="#3f3f46"/>
  <text x="${padding}" y="30" font-family="system-ui,sans-serif" font-size="14" font-weight="700">
    <tspan fill="#34d399">Push</tspan><tspan fill="#fff">CI</tspan>
  </text>
  <text x="${padding}" y="52" font-family="system-ui,sans-serif" font-size="12" fill="#a1a1aa">${repo}</text>
  ${jobsSvg}
  <text x="${padding}" y="${height - 14}" font-family="system-ui,sans-serif" font-size="10" fill="#71717a">Total: ${formatDuration(totalMs)}</text>
</svg>`;
}

export async function handlePipelineCard(c: Context<{ Bindings: Env }>): Promise<Response> {
  const owner = c.req.param("owner");
  const repo = c.req.param("repo");
  const fullRepo = `${owner}/${repo}`;

  const row = await c.env.DB.prepare(
    "SELECT checks_json, duration_ms FROM runs WHERE repo = ? ORDER BY started_at DESC LIMIT 1"
  ).bind(fullRepo).first<{ checks_json: string | null; duration_ms: number | null }>();

  const jobs = parseJobs(row?.checks_json ?? null);
  const totalMs = row?.duration_ms ?? 0;
  const svg = renderPipelineCard(fullRepo, jobs, totalMs);

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "max-age=3600",
    },
  });
}
