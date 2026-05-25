// Achievements / Gamification — badge system with XP.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

// --- Types ---

interface Badge {
  id: string;
  name: string;
  description: string;
  category: "runs" | "streaks" | "quality" | "team" | "special";
  xp: number;
}

interface AwardedBadge {
  id: string;
  awarded_at: string;
}

interface BadgeWithStatus extends Badge {
  unlocked: boolean;
  awarded_at: string | null;
}

interface LeaderboardEntry {
  user_sub: string;
  login: string;
  xp: number;
  badge_count: number;
}

// --- Badge definitions ---

const BADGES: Badge[] = [
  { id: "first_run", name: "First Blood", description: "Triggered your first CI run", category: "runs", xp: 10 },
  { id: "ten_runs", name: "Getting Serious", description: "10 CI runs completed", category: "runs", xp: 25 },
  { id: "hundred_runs", name: "CI Veteran", description: "100 CI runs completed", category: "runs", xp: 100 },
  { id: "thousand_runs", name: "CI Legend", description: "1,000 CI runs completed", category: "runs", xp: 500 },
  { id: "streak_7", name: "Week Warrior", description: "7 consecutive days with runs", category: "streaks", xp: 50 },
  { id: "streak_30", name: "Monthly Machine", description: "30 consecutive days with runs", category: "streaks", xp: 200 },
  { id: "streak_100", name: "Unstoppable", description: "100 consecutive days with runs", category: "streaks", xp: 1000 },
  { id: "all_green", name: "Green Machine", description: "10 consecutive passing runs", category: "quality", xp: 75 },
  { id: "zero_failures_week", name: "Perfect Week", description: "No failures for 7 days", category: "quality", xp: 50 },
  { id: "fast_runner", name: "Speed Demon", description: "Average build time under 30 seconds", category: "quality", xp: 100 },
  { id: "first_project", name: "Architect", description: "Created your first project", category: "team", xp: 15 },
  { id: "five_projects", name: "Empire Builder", description: "Managing 5+ projects", category: "team", xp: 75 },
  { id: "team_player", name: "Team Player", description: "Added to 3+ project teams", category: "team", xp: 50 },
  { id: "night_owl", name: "Night Owl", description: "Triggered a run between midnight and 5am", category: "special", xp: 25 },
  { id: "weekend_warrior", name: "Weekend Warrior", description: "Triggered runs on both Saturday and Sunday", category: "special", xp: 25 },
  { id: "early_adopter", name: "Early Adopter", description: "Account created in first 1000 users", category: "special", xp: 200 },
];

const BADGE_MAP = new Map(BADGES.map((b) => [b.id, b]));

// --- KV helpers ---

async function getAwarded(kv: KVNamespace, userSub: string): Promise<AwardedBadge[]> {
  const raw = await kv.get(`badges:${userSub}`);
  if (!raw) return [];
  return JSON.parse(raw) as AwardedBadge[];
}

async function saveAwarded(kv: KVNamespace, userSub: string, badges: AwardedBadge[]): Promise<void> {
  await kv.put(`badges:${userSub}`, JSON.stringify(badges));
}

// --- Exported utilities ---

export async function getUserXP(db: D1Database, userSub: string): Promise<number> {
  // XP is derived from badges — we need KV but can fallback to re-check
  // This function is intentionally DB-only for use without KV context.
  // Callers with KV should use getAwarded + sumXP instead.
  // We store a cached XP value in a simple KV-less lookup table.
  const row = await db.prepare(
    "SELECT details_json FROM audit_logs WHERE action = 'badge_awarded' AND actor_sub = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(userSub).first<{ details_json: string }>();
  if (!row) return 0;
  try {
    const details = JSON.parse(row.details_json);
    return typeof details.total_xp === "number" ? details.total_xp : 0;
  } catch {
    return 0;
  }
}

function sumXP(awarded: AwardedBadge[]): number {
  let total = 0;
  for (const a of awarded) {
    const badge = BADGE_MAP.get(a.id);
    if (badge) total += badge.xp;
  }
  return total;
}

export async function checkAndAwardBadges(
  db: D1Database,
  kv: KVNamespace,
  userSub: string,
): Promise<string[]> {
  const awarded = await getAwarded(kv, userSub);
  const owned = new Set(awarded.map((a) => a.id));
  const newlyAwarded: string[] = [];
  const now = new Date().toISOString();

  // Helper: get repos this user has membership on
  const memberProjects = await db.prepare(
    "SELECT project_id FROM project_memberships WHERE user_sub = ?"
  ).bind(userSub).all<{ project_id: string }>();
  const projectIds = (memberProjects.results ?? []).map((r) => r.project_id);

  if (projectIds.length === 0) return [];

  // Build a repo list from projects
  const placeholders = projectIds.map(() => "?").join(",");
  const projects = await db.prepare(
    `SELECT repo FROM projects WHERE id IN (${placeholders})`
  ).bind(...projectIds).all<{ repo: string }>();
  const repos = (projects.results ?? []).map((r) => r.repo);

  if (repos.length === 0) return [];

  const repoPlaceholders = repos.map(() => "?").join(",");

  // --- Run milestones ---
  if (!owned.has("first_run") || !owned.has("ten_runs") || !owned.has("hundred_runs") || !owned.has("thousand_runs")) {
    const countRow = await db.prepare(
      `SELECT COUNT(*) as cnt FROM runs WHERE repo IN (${repoPlaceholders})`
    ).bind(...repos).first<{ cnt: number }>();
    const cnt = countRow?.cnt ?? 0;

    if (cnt >= 1 && !owned.has("first_run")) newlyAwarded.push("first_run");
    if (cnt >= 10 && !owned.has("ten_runs")) newlyAwarded.push("ten_runs");
    if (cnt >= 100 && !owned.has("hundred_runs")) newlyAwarded.push("hundred_runs");
    if (cnt >= 1000 && !owned.has("thousand_runs")) newlyAwarded.push("thousand_runs");
  }

  // --- Streak badges ---
  if (!owned.has("streak_7") || !owned.has("streak_30") || !owned.has("streak_100")) {
    const datesResult = await db.prepare(
      `SELECT DISTINCT date(created_at) as d FROM runs WHERE repo IN (${repoPlaceholders}) ORDER BY d DESC LIMIT 200`
    ).bind(...repos).all<{ d: string }>();
    const dates = (datesResult.results ?? []).map((r) => r.d);
    const streak = computeStreak(dates);

    if (streak >= 7 && !owned.has("streak_7")) newlyAwarded.push("streak_7");
    if (streak >= 30 && !owned.has("streak_30")) newlyAwarded.push("streak_30");
    if (streak >= 100 && !owned.has("streak_100")) newlyAwarded.push("streak_100");
  }

  // --- Quality: all_green (10 consecutive passing) ---
  if (!owned.has("all_green")) {
    const recentRuns = await db.prepare(
      `SELECT status FROM runs WHERE repo IN (${repoPlaceholders}) ORDER BY created_at DESC LIMIT 10`
    ).bind(...repos).all<{ status: string }>();
    const statuses = (recentRuns.results ?? []).map((r) => r.status);
    if (statuses.length >= 10 && statuses.every((s) => s === "passed")) {
      newlyAwarded.push("all_green");
    }
  }

  // --- Quality: zero_failures_week ---
  if (!owned.has("zero_failures_week")) {
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const failCount = await db.prepare(
      `SELECT COUNT(*) as cnt FROM runs WHERE repo IN (${repoPlaceholders}) AND status = 'failed' AND created_at >= ?`
    ).bind(...repos, weekAgo).first<{ cnt: number }>();
    const totalWeek = await db.prepare(
      `SELECT COUNT(*) as cnt FROM runs WHERE repo IN (${repoPlaceholders}) AND created_at >= ?`
    ).bind(...repos, weekAgo).first<{ cnt: number }>();
    if ((totalWeek?.cnt ?? 0) > 0 && (failCount?.cnt ?? 0) === 0) {
      newlyAwarded.push("zero_failures_week");
    }
  }

  // --- Quality: fast_runner (avg under 30s) ---
  if (!owned.has("fast_runner")) {
    const avgRow = await db.prepare(
      `SELECT AVG(duration_ms) as avg_ms FROM runs WHERE repo IN (${repoPlaceholders}) AND duration_ms > 0`
    ).bind(...repos).first<{ avg_ms: number | null }>();
    const totalWithDuration = await db.prepare(
      `SELECT COUNT(*) as cnt FROM runs WHERE repo IN (${repoPlaceholders}) AND duration_ms > 0`
    ).bind(...repos).first<{ cnt: number }>();
    if ((totalWithDuration?.cnt ?? 0) >= 5 && avgRow?.avg_ms != null && avgRow.avg_ms < 30000) {
      newlyAwarded.push("fast_runner");
    }
  }

  // --- Team: first_project / five_projects ---
  if (!owned.has("first_project") || !owned.has("five_projects")) {
    const projCount = projectIds.length;
    if (projCount >= 1 && !owned.has("first_project")) newlyAwarded.push("first_project");
    if (projCount >= 5 && !owned.has("five_projects")) newlyAwarded.push("five_projects");
  }

  // --- Team: team_player (member of 3+ projects) ---
  if (!owned.has("team_player") && projectIds.length >= 3) {
    newlyAwarded.push("team_player");
  }

  // --- Special: night_owl ---
  if (!owned.has("night_owl")) {
    const nightRun = await db.prepare(
      `SELECT id FROM runs WHERE repo IN (${repoPlaceholders}) AND CAST(strftime('%H', created_at) AS INTEGER) < 5 LIMIT 1`
    ).bind(...repos).first();
    if (nightRun) newlyAwarded.push("night_owl");
  }

  // --- Special: weekend_warrior ---
  if (!owned.has("weekend_warrior")) {
    const satRun = await db.prepare(
      `SELECT id FROM runs WHERE repo IN (${repoPlaceholders}) AND CAST(strftime('%w', created_at) AS INTEGER) = 6 LIMIT 1`
    ).bind(...repos).first();
    const sunRun = await db.prepare(
      `SELECT id FROM runs WHERE repo IN (${repoPlaceholders}) AND CAST(strftime('%w', created_at) AS INTEGER) = 0 LIMIT 1`
    ).bind(...repos).first();
    if (satRun && sunRun) newlyAwarded.push("weekend_warrior");
  }

  // --- Special: early_adopter ---
  if (!owned.has("early_adopter")) {
    const userRank = await db.prepare(
      "SELECT COUNT(DISTINCT user_sub) as cnt FROM project_memberships WHERE created_at <= (SELECT MIN(created_at) FROM project_memberships WHERE user_sub = ?)"
    ).bind(userSub).first<{ cnt: number }>();
    if ((userRank?.cnt ?? Infinity) <= 1000) {
      newlyAwarded.push("early_adopter");
    }
  }

  // Persist newly awarded badges
  if (newlyAwarded.length > 0) {
    for (const id of newlyAwarded) {
      awarded.push({ id, awarded_at: now });
    }
    await saveAwarded(kv, userSub, awarded);

    // Write audit log with total XP for getUserXP fallback
    const totalXP = sumXP(awarded);
    await db.prepare(
      "INSERT INTO audit_logs (actor_sub, actor_login, action, resource_type, resource_id, details_json) VALUES (?, ?, 'badge_awarded', 'badge', ?, ?)"
    ).bind(
      userSub,
      userSub,
      newlyAwarded.join(","),
      JSON.stringify({ badges: newlyAwarded, total_xp: totalXP }),
    ).run();
  }

  return newlyAwarded;
}

// --- Streak calculator ---

function computeStreak(sortedDatesDesc: string[]): number {
  if (sortedDatesDesc.length === 0) return 0;

  let streak = 1;
  for (let i = 1; i < sortedDatesDesc.length; i++) {
    const prev = new Date(sortedDatesDesc[i - 1] + "T00:00:00Z");
    const curr = new Date(sortedDatesDesc[i] + "T00:00:00Z");
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// --- Auth helper ---

async function getAuthUser(c: { req: { header: (n: string) => string | undefined }; env: Env }) {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  return verifyJwt(token, c.env.JWT_SECRET);
}

// --- Routes ---

export const achievementRoutes = new Hono<{ Bindings: Env }>();

// GET / — alias for /badges (dashboard calls /api/achievements directly)
achievementRoutes.get("/", async (c) => c.redirect("/api/achievements/badges", 307));

// GET /badges — all badges with unlocked status for current user
achievementRoutes.get("/badges", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const awarded = await getAwarded(c.env.RUNNERS, user.sub);
  const awardedMap = new Map(awarded.map((a) => [a.id, a.awarded_at]));

  const badges: BadgeWithStatus[] = BADGES.map((b) => ({
    ...b,
    unlocked: awardedMap.has(b.id),
    awarded_at: awardedMap.get(b.id) ?? null,
  }));

  const totalXP = sumXP(awarded);

  return c.json({ badges, xp: totalXP, unlocked: awarded.length, total: BADGES.length });
});

// GET /leaderboard — top 20 users by XP
achievementRoutes.get("/leaderboard", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  // Collect all badge keys from KV via audit_logs (no KV list in Workers free tier)
  const recentAwards = await c.env.DB.prepare(
    "SELECT DISTINCT actor_sub FROM audit_logs WHERE action = 'badge_awarded' ORDER BY created_at DESC LIMIT 100"
  ).all<{ actor_sub: string }>();

  const entries: LeaderboardEntry[] = [];

  for (const row of recentAwards.results ?? []) {
    const awarded = await getAwarded(c.env.RUNNERS, row.actor_sub);
    if (awarded.length === 0) continue;
    const xp = sumXP(awarded);

    // Resolve login from project_memberships
    const member = await c.env.DB.prepare(
      "SELECT login FROM project_memberships WHERE user_sub = ? LIMIT 1"
    ).bind(row.actor_sub).first<{ login: string }>();

    entries.push({
      user_sub: row.actor_sub,
      login: member?.login ?? row.actor_sub,
      xp,
      badge_count: awarded.length,
    });
  }

  entries.sort((a, b) => b.xp - a.xp);

  return c.json({ leaderboard: entries.slice(0, 20) });
});

// GET /profile/:sub — public achievement profile
achievementRoutes.get("/profile/:sub", async (c) => {
  const sub = decodeURIComponent(c.req.param("sub"));

  const awarded = await getAwarded(c.env.RUNNERS, sub);
  const awardedMap = new Map(awarded.map((a) => [a.id, a.awarded_at]));

  const badges: BadgeWithStatus[] = BADGES.map((b) => ({
    ...b,
    unlocked: awardedMap.has(b.id),
    awarded_at: awardedMap.get(b.id) ?? null,
  }));

  const totalXP = sumXP(awarded);

  // Resolve login
  const member = await c.env.DB.prepare(
    "SELECT login FROM project_memberships WHERE user_sub = ? LIMIT 1"
  ).bind(sub).first<{ login: string }>();

  return c.json({
    user_sub: sub,
    login: member?.login ?? sub,
    badges,
    xp: totalXP,
    unlocked: awarded.length,
    total: BADGES.length,
  });
});

// POST /check — check and award new badges for current user
achievementRoutes.post("/check", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const newBadges = await checkAndAwardBadges(c.env.DB, c.env.RUNNERS, user.sub);

  return c.json({
    new_badges: newBadges.map((id) => BADGE_MAP.get(id)!),
    count: newBadges.length,
  });
});
