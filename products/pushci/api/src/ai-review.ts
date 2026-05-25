// AI-powered code review module for PushCI CI pipeline.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import { CLAUDE_HAIKU_MODEL } from "./ai-model";
import type { Env } from "./types";

type Bindings = Env;
export const aiReviewRoutes = new Hono<{ Bindings: Bindings }>();

const MAX_DIFF_SIZE = 50_000;
const REVIEW_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

interface ReviewIssue {
  severity: "critical" | "warning" | "suggestion";
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
}

interface ReviewMetrics {
  security: number;
  performance: number;
  maintainability: number;
  test_coverage_hint: string;
}

interface ReviewResult {
  summary: string;
  score: number;
  issues: ReviewIssue[];
  metrics: ReviewMetrics;
  approved: boolean;
}

async function getUser(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

function buildSystemPrompt(severity: string): string {
  const base = [
    "You are a senior code reviewer for a CI/CD platform.",
    "Review the following git diff and provide structured feedback.",
    "Focus on: security vulnerabilities, performance issues,",
    "code quality, and best practices. Be concise and actionable.",
  ].join(" ");

  const level = severity === "strict"
    ? " Be very strict — flag all potential issues."
    : severity === "lenient"
      ? " Be lenient — only flag clear bugs and security issues."
      : " Use balanced judgment.";

  return base + level + "\n\nRespond ONLY with valid JSON matching this schema:\n" + JSON.stringify({
    summary: "string — 1-2 sentence overall assessment",
    score: "number 0-100",
    issues: [{ severity: "critical|warning|suggestion", file: "string", line: "number|null", message: "string", suggestion: "string|null" }],
    metrics: { security: "0-100", performance: "0-100", maintainability: "0-100", test_coverage_hint: "string" },
  });
}

function buildUserPrompt(diff: string, context?: string, language?: string): string {
  const parts = ["Review this diff:"];
  if (language) parts.push(`Primary language: ${language}`);
  if (context) parts.push(`Context: ${context}`);
  parts.push("```diff\n" + diff.slice(0, MAX_DIFF_SIZE) + "\n```");
  return parts.join("\n\n");
}

function mockReview(): ReviewResult {
  return {
    summary: "AI review unavailable — ANTHROPIC_API_KEY not configured.",
    score: 50,
    issues: [{ severity: "suggestion", file: "unknown", message: "Configure ANTHROPIC_API_KEY for real reviews." }],
    metrics: { security: 50, performance: 50, maintainability: 50, test_coverage_hint: "Unable to assess without AI." },
    approved: false,
  };
}

function parseReview(text: string): ReviewResult {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { summary: text.slice(0, 200), score: 50, issues: [], metrics: { security: 50, performance: 50, maintainability: 50, test_coverage_hint: "Could not parse AI response." }, approved: false };
  }
  const raw = JSON.parse(jsonMatch[0]);
  const score = typeof raw.score === "number" ? Math.max(0, Math.min(100, raw.score)) : 50;
  const issues: ReviewIssue[] = Array.isArray(raw.issues) ? raw.issues.map((i: Record<string, unknown>) => ({
    severity: (["critical", "warning", "suggestion"].includes(i.severity as string) ? i.severity : "suggestion") as ReviewIssue["severity"],
    file: String(i.file ?? "unknown"),
    line: typeof i.line === "number" ? i.line : undefined,
    message: String(i.message ?? ""),
    suggestion: i.suggestion ? String(i.suggestion) : undefined,
  })) : [];
  const m = raw.metrics ?? {};
  const clamp = (v: unknown) => typeof v === "number" ? Math.max(0, Math.min(100, v)) : 50;
  const metrics: ReviewMetrics = {
    security: clamp(m.security),
    performance: clamp(m.performance),
    maintainability: clamp(m.maintainability),
    test_coverage_hint: typeof m.test_coverage_hint === "string" ? m.test_coverage_hint : "No test changes detected",
  };
  const hasCritical = issues.some((i) => i.severity === "critical");
  return { summary: String(raw.summary ?? ""), score, issues, metrics, approved: score >= 70 && !hasCritical };
}

/** POST /review — AI-powered diff review. */
aiReviewRoutes.post("/review", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    diff: string;
    context?: string;
    language?: string;
    severity?: "strict" | "normal" | "lenient";
  }>();

  if (!body.diff) return c.json({ error: "diff is required" }, 400);
  if (body.diff.length > MAX_DIFF_SIZE) {
    return c.json({ error: `diff exceeds max size of ${MAX_DIFF_SIZE} characters` }, 400);
  }

  if (!c.env.ANTHROPIC_API_KEY) {
    return c.json(mockReview());
  }

  const system = buildSystemPrompt(body.severity ?? "normal");
  const userMsg = buildUserPrompt(body.diff, body.context, body.language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": c.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_HAIKU_MODEL,
        max_tokens: 2048,
        system,
        messages: [{ role: "user", content: userMsg }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.text();
      return c.json({ error: "Claude API error", detail: err }, 502);
    }

    const msg = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    const text = msg.content
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text!)
      .join("\n");

    const review = parseReview(text);

    // Store in KV for history
    const kvKey = `review:${user.sub}:${Date.now()}`;
    await c.env.RUNNERS.put(kvKey, JSON.stringify({
      summary: review.summary,
      score: review.score,
      approved: review.approved,
      issues_count: review.issues.length,
      timestamp: new Date().toISOString(),
    }), { expirationTtl: REVIEW_TTL });

    return c.json(review);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return c.json({ error: "Review timed out (30s limit)" }, 504);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
});

/** POST /review/pr — stub for PR-based review. */
aiReviewRoutes.post("/review/pr", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    repo: string;
    prNumber: number;
    platform: "github" | "gitlab" | "bitbucket";
  }>();

  if (!body.repo || !body.prNumber || !body.platform) {
    return c.json({ error: "repo, prNumber, and platform are required" }, 400);
  }

  return c.json({ status: "queued", message: "PR review will be posted as a comment" });
});

/** GET /review/history — recent reviews for the authenticated user. */
aiReviewRoutes.get("/review/history", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const prefix = `review:${user.sub}:`;
  const list = await c.env.RUNNERS.list({ prefix, limit: 20 });

  const reviews: Array<{ key: string; summary: string; score: number; approved: boolean; issues_count: number; timestamp: string }> = [];
  for (const key of list.keys) {
    const val = await c.env.RUNNERS.get(key.name);
    if (val) {
      try {
        reviews.push({ key: key.name, ...JSON.parse(val) });
      } catch { /* skip malformed */ }
    }
  }

  // Sort by timestamp descending and take last 10
  reviews.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return c.json({ reviews: reviews.slice(0, 10) });
});
