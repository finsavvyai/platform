/**
 * Benchmark: run-indexes
 *
 * Validates EXPLAIN QUERY PLAN output for the top 5 hot-path queries against
 * a synthetic SQLite database (D1 is SQLite-compatible).
 *
 * Run:
 *   npx ts-node packages/database/test/run-indexes.benchmark.ts
 *
 * Exit code 0 if every query reports an index-driven plan; 1 otherwise.
 *
 * Before / After expectations:
 *  - BEFORE indexes: SQLite reports `SCAN` on the target table for each query.
 *    On a 100k-row dataset this is O(N) per query (≈100ms+ in D1).
 *  - AFTER indexes:  SQLite reports `SEARCH ... USING INDEX <name>`.
 *    Cost drops to O(log N) → typically <2ms per query in D1.
 *
 * Author: agent-1a-2
 */

import Database from "better-sqlite3";

interface QueryCase {
  name: string;
  sql: string;
  params: unknown[];
  // Expectation phrase that must appear in the EXPLAIN plan after indexing.
  expectAfter: string;
}

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE agent_executions (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL,
      taskId TEXT,
      instanceId TEXT NOT NULL,
      status TEXT NOT NULL,
      startTime INTEGER,
      endTime INTEGER,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE task_executions (
      id TEXT PRIMARY KEY,
      taskId TEXT NOT NULL,
      attempt INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      startTime INTEGER,
      endTime INTEGER,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE health_checks (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE agent_status_transitions (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL,
      executionId TEXT,
      fromStatus TEXT,
      toStatus TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL,
      agentId TEXT,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );
  `);
}

function createIndexes(db: Database.Database): void {
  db.exec(`
    CREATE INDEX idx_agent_executions_agent_status_created
      ON agent_executions (agentId, status, createdAt);
    CREATE INDEX idx_agent_executions_status_created
      ON agent_executions (status, createdAt);
    CREATE INDEX idx_task_executions_task_status_created
      ON task_executions (taskId, status, createdAt);
    CREATE INDEX idx_health_checks_agent_ts
      ON health_checks (agentId, timestamp);
    CREATE INDEX idx_tasks_project_status_created
      ON tasks (projectId, status, createdAt);
  `);
}

function seed(db: Database.Database, n = 5_000): void {
  const insertExec = db.prepare(
    "INSERT INTO agent_executions (id, agentId, taskId, instanceId, status, startTime, endTime, createdAt) VALUES (?,?,?,?,?,?,?,?)",
  );
  const insertStep = db.prepare(
    "INSERT INTO task_executions (id, taskId, attempt, status, startTime, endTime, createdAt) VALUES (?,?,?,?,?,?,?)",
  );
  const insertLog = db.prepare(
    "INSERT INTO health_checks (id, agentId, status, timestamp) VALUES (?,?,?,?)",
  );
  const insertTask = db.prepare(
    "INSERT INTO tasks (id, projectId, agentId, status, priority, createdAt) VALUES (?,?,?,?,?,?)",
  );
  const txn = db.transaction(() => {
    for (let i = 0; i < n; i++) {
      const agentId = `agent-${i % 50}`;
      const projectId = `proj-${i % 25}`;
      const ts = 1_700_000_000_000 + i * 1000;
      const status = i % 4 === 0 ? "RUNNING" : "COMPLETED";
      insertExec.run(`e${i}`, agentId, `t${i}`, `inst-${i}`, status, ts, ts + 500, ts);
      insertStep.run(`s${i}`, `t${i}`, (i % 3) + 1, status, ts, ts + 100, ts);
      insertLog.run(`h${i}`, agentId, status, ts);
      insertTask.run(`t${i}`, projectId, agentId, status, "NORMAL", ts);
    }
  });
  txn();
}

const QUERIES: QueryCase[] = [
  {
    name: "1. runs by agent + status, recent first",
    sql: "SELECT id FROM agent_executions WHERE agentId = ? AND status = ? ORDER BY createdAt DESC LIMIT 20",
    params: ["agent-7", "RUNNING"],
    expectAfter: "idx_agent_executions_agent_status_created",
  },
  {
    name: "2. global queue scan by status",
    sql: "SELECT id FROM agent_executions WHERE status = ? ORDER BY createdAt DESC LIMIT 50",
    params: ["RUNNING"],
    expectAfter: "idx_agent_executions_status_created",
  },
  {
    name: "3. run_steps for a run, by status",
    sql: "SELECT id FROM task_executions WHERE taskId = ? AND status = ? ORDER BY createdAt DESC",
    params: ["t42", "COMPLETED"],
    expectAfter: "idx_task_executions_task_status_created",
  },
  {
    name: "4. run_logs (health_checks) by agent timeline",
    sql: "SELECT id FROM health_checks WHERE agentId = ? ORDER BY timestamp DESC LIMIT 100",
    params: ["agent-3"],
    expectAfter: "idx_health_checks_agent_ts",
  },
  {
    name: "5. tenant-scoped tasks by status, recent first",
    sql: "SELECT id FROM tasks WHERE projectId = ? AND status = ? ORDER BY createdAt DESC LIMIT 25",
    params: ["proj-5", "COMPLETED"],
    expectAfter: "idx_tasks_project_status_created",
  },
];

function explain(db: Database.Database, sql: string, params: unknown[]): string {
  const rows = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as Array<{ detail: string }>;
  return rows.map((r) => r.detail).join(" | ");
}

function main(): void {
  const db = new Database(":memory:");
  createSchema(db);
  seed(db);

  console.log("=== BEFORE indexes (expect SCAN) ===");
  for (const q of QUERIES) {
    console.log(`- ${q.name}\n  ${explain(db, q.sql, q.params)}`);
  }

  createIndexes(db);

  console.log("\n=== AFTER indexes (expect SEARCH USING INDEX) ===");
  let pass = 0;
  for (const q of QUERIES) {
    const plan = explain(db, q.sql, q.params);
    const ok = plan.includes(q.expectAfter);
    console.log(`- ${q.name}\n  ${plan}\n  ${ok ? "PASS" : "FAIL"} (expected ${q.expectAfter})`);
    if (ok) pass += 1;
  }
  console.log(`\n${pass}/${QUERIES.length} queries hit expected indexes.`);
  process.exit(pass === QUERIES.length ? 0 : 1);
}

if (require.main === module) {
  main();
}

export { QUERIES, createSchema, createIndexes, explain };
