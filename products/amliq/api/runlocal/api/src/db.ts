import type { Run, Project } from "./types";

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  sha TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT,
  finished_at TEXT,
  duration_ms INTEGER,
  checks_json TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  repo TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  webhook_secret TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_repo ON runs(repo);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
`;

export async function insertRun(db: D1Database, run: Run): Promise<void> {
  await db
    .prepare(
      `INSERT INTO runs (id, repo, branch, sha, status)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(run.id, run.repo, run.branch, run.sha, run.status)
    .run();
}

export async function getRun(db: D1Database, id: string): Promise<Run | null> {
  const result = await db
    .prepare("SELECT * FROM runs WHERE id = ?")
    .bind(id)
    .first<Run>();
  return result ?? null;
}

export async function listRuns(
  db: D1Database,
  limit = 50,
  offset = 0
): Promise<Run[]> {
  const { results } = await db
    .prepare("SELECT * FROM runs ORDER BY started_at DESC LIMIT ? OFFSET ?")
    .bind(limit, offset)
    .all<Run>();
  return results;
}

export async function listProjects(db: D1Database): Promise<Project[]> {
  const { results } = await db
    .prepare("SELECT * FROM projects ORDER BY created_at DESC")
    .all<Project>();
  return results;
}

export async function getProjectByRepo(
  db: D1Database,
  repo: string
): Promise<Project | null> {
  const result = await db
    .prepare("SELECT * FROM projects WHERE repo = ?")
    .bind(repo)
    .first<Project>();
  return result ?? null;
}

export async function migrateDb(db: D1Database): Promise<void> {
  const statements = SCHEMA_SQL.split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const sql of statements) {
    await db.prepare(sql).run();
  }
}
