import type { Env } from "./types";
import type { Context } from "hono";

interface RepoStats {
  total: number;
  passed: number;
  avgDuration: number;
}

async function fetchStats(db: D1Database, repo: string): Promise<RepoStats> {
  const rows = await db
    .prepare("SELECT status, duration_ms FROM runs WHERE repo = ?")
    .bind(repo)
    .all<{ status: string; duration_ms: number | null }>();
  const all = rows.results ?? [];
  const passed = all.filter((r) => r.status === "passed").length;
  const durations = all.filter((r) => r.duration_ms).map((r) => r.duration_ms!);
  const avgDuration = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  return { total: all.length, passed, avgDuration };
}

function passRate(stats: RepoStats): string {
  if (stats.total === 0) return "0%";
  return `${Math.round((stats.passed / stats.total) * 100)}%`;
}

function timeSaved(stats: RepoStats): string {
  const cloudMin = stats.total * 2; // avg 2 min cloud overhead per run
  return `${cloudMin} min`;
}

function costSaved(stats: RepoStats): string {
  const ghCost = stats.total * (stats.avgDuration / 60000) * 0.008;
  return `$${ghCost.toFixed(2)}`;
}

function renderCard(repo: string, stats: RepoStats): string {
  const pr = passRate(stats);
  const ts = timeSaved(stats);
  const cs = costSaved(stats);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="220" viewBox="0 0 480 220">
  <rect width="480" height="220" rx="12" fill="#18181b"/>
  <rect x="1" y="1" width="478" height="218" rx="11" fill="none" stroke="#3f3f46" stroke-width="1"/>
  <text x="24" y="36" font-family="system-ui,sans-serif" font-size="14" font-weight="700">
    <tspan fill="#34d399">Push</tspan><tspan fill="#fff">CI</tspan>
  </text>
  <text x="24" y="64" font-family="system-ui,sans-serif" font-size="16" fill="#e4e4e7" font-weight="600">${repo}</text>
  <line x1="24" y1="80" x2="456" y2="80" stroke="#3f3f46"/>
  <text x="24" y="110" font-family="system-ui,sans-serif" font-size="12" fill="#a1a1aa">Total Runs</text>
  <text x="24" y="132" font-family="system-ui,sans-serif" font-size="22" fill="#fff" font-weight="700">${stats.total}</text>
  <text x="150" y="110" font-family="system-ui,sans-serif" font-size="12" fill="#a1a1aa">Pass Rate</text>
  <text x="150" y="132" font-family="system-ui,sans-serif" font-size="22" fill="#34d399" font-weight="700">${pr}</text>
  <text x="270" y="110" font-family="system-ui,sans-serif" font-size="12" fill="#a1a1aa">Time Saved</text>
  <text x="270" y="132" font-family="system-ui,sans-serif" font-size="22" fill="#fff" font-weight="700">${ts}</text>
  <text x="380" y="110" font-family="system-ui,sans-serif" font-size="12" fill="#a1a1aa">Cost Saved</text>
  <text x="380" y="132" font-family="system-ui,sans-serif" font-size="22" fill="#34d399" font-weight="700">${cs}</text>
  <rect x="24" y="160" width="432" height="36" rx="8" fill="#052e16"/>
  <text x="240" y="183" font-family="system-ui,sans-serif" font-size="13" fill="#34d399" text-anchor="middle" font-weight="600">
    Running CI locally for free with PushCI
  </text>
</svg>`;
}

export async function handleOgCard(c: Context<{ Bindings: Env }>): Promise<Response> {
  const owner = c.req.param("owner");
  const repo = c.req.param("repo");
  const fullRepo = `${owner}/${repo}`;
  const stats = await fetchStats(c.env.DB, fullRepo);
  const svg = renderCard(fullRepo, stats);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "max-age=3600",
    },
  });
}
