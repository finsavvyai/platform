import { Hono } from "hono";
import type { Env } from "./types";

interface CalcInput {
  runs_per_month: number;
  avg_duration_min: number;
  os: "linux" | "macos";
}

interface ProviderCost {
  github_actions: number;
  circleci: number;
  gitlab_ci: number;
  pushci: number;
  savings_vs_github: number;
  savings_percent: number;
}

const RATES: Record<string, Record<string, number>> = {
  linux: { github: 0.008, circleci: 0.006, gitlab: 0.008, pushci: 0.003 },
  macos: { github: 0.08, circleci: 0.06, gitlab: 0.08, pushci: 0.003 },
};

function calculate(input: CalcInput): ProviderCost {
  const { runs_per_month, avg_duration_min, os } = input;
  const totalMin = runs_per_month * avg_duration_min;
  const rates = RATES[os] ?? RATES.linux;

  const github_actions = round(totalMin * rates.github);
  const circleci = round(totalMin * rates.circleci);
  const gitlab_ci = round(totalMin * rates.gitlab);
  const pushci = 0; // self-hosted = free
  const savings_vs_github = round(github_actions - pushci);
  const savings_percent = github_actions > 0
    ? Math.round((savings_vs_github / github_actions) * 100)
    : 0;

  return { github_actions, circleci, gitlab_ci, pushci, savings_vs_github, savings_percent };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseInput(raw: Record<string, unknown>): CalcInput | null {
  const runs = Number(raw.runs_per_month ?? raw.runs ?? 0);
  const dur = Number(raw.avg_duration_min ?? raw.duration ?? 0);
  const os = String(raw.os ?? "linux");
  if (runs <= 0 || dur <= 0) return null;
  if (os !== "linux" && os !== "macos") return null;
  return { runs_per_month: runs, avg_duration_min: dur, os };
}

export const costRoutes = new Hono<{ Bindings: Env }>();

costRoutes.post("/calculate-cost", async (c) => {
  const body = await c.req.json();
  const input = parseInput(body);
  if (!input) return c.json({ error: "Invalid input: runs_per_month, avg_duration_min, os required" }, 400);
  return c.json(calculate(input));
});

costRoutes.get("/calculate-cost", (c) => {
  const raw = {
    runs_per_month: c.req.query("runs"),
    avg_duration_min: c.req.query("duration"),
    os: c.req.query("os") ?? "linux",
  };
  const input = parseInput(raw as Record<string, unknown>);
  if (!input) return c.json({ error: "Required: runs, duration, os (linux|macos)" }, 400);
  return c.json(calculate(input));
});
