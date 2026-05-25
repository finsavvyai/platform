import type { AgentRunRecord, AgentRunResponse, AgentRunStatus } from './types';

export interface AgentRunStatusPatch {
  status: AgentRunStatus;
  summary?: string | null;
  result?: unknown;
  error?: unknown;
  usage?: unknown;
}

interface AgentRunRow {
  run_id: string;
  project_id: string;
  session_id: string;
  tenant_id: string;
  user_id: string;
  api_key_id: string;
  adapter: string;
  model: string;
  status: AgentRunStatus;
  goal: string;
  summary: string | null;
  result_json: string | null;
  error_json: string | null;
  usage_json: string | null;
  created_at: string;
  updated_at: string;
}

export async function insertAgentRun(db: D1Database, run: AgentRunRecord): Promise<void> {
  await db
    .prepare(
      `
      INSERT INTO agent_runs (
        run_id, project_id, session_id, tenant_id, user_id, api_key_id, adapter,
        model, status, goal, summary, result_json, error_json, usage_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .bind(
      run.run_id,
      run.project_id,
      run.session_id,
      run.tenant_id,
      run.user_id,
      run.api_key_id,
      run.adapter,
      run.model,
      run.status,
      run.goal,
      run.summary,
      run.result_json,
      run.error_json,
      run.usage_json,
      run.created_at,
      run.updated_at
    )
    .run();
}

export async function getAgentRun(db: D1Database, runId: string): Promise<AgentRunRecord | null> {
  const row = await db
    .prepare(
      `
      SELECT
        run_id, project_id, session_id, tenant_id, user_id, api_key_id, adapter,
        model, status, goal, summary, result_json, error_json, usage_json, created_at, updated_at
      FROM agent_runs
      WHERE run_id = ?
    `
    )
    .bind(runId)
    .first<AgentRunRow>();

  return row ? mapAgentRunRow(row) : null;
}

export async function updateAgentRunStatus(
  db: D1Database,
  runId: string,
  patch: AgentRunStatusPatch
): Promise<void> {
  const updatedAt = new Date().toISOString();

  await db
    .prepare(
      `
      UPDATE agent_runs
      SET status = ?,
          summary = COALESCE(?, summary),
          result_json = COALESCE(?, result_json),
          error_json = COALESCE(?, error_json),
          usage_json = COALESCE(?, usage_json),
          updated_at = ?
      WHERE run_id = ?
    `
    )
    .bind(
      patch.status,
      patch.summary ?? null,
      patch.result === undefined ? null : JSON.stringify(patch.result),
      patch.error === undefined ? null : JSON.stringify(patch.error),
      patch.usage === undefined ? null : JSON.stringify(patch.usage),
      updatedAt,
      runId
    )
    .run();
}

export function toAgentRunResponse(run: AgentRunRecord): AgentRunResponse {
  return {
    run_id: run.run_id,
    status: run.status,
    project_id: run.project_id,
    session_id: run.session_id,
    tenant_id: run.tenant_id,
    user_id: run.user_id,
    adapter: run.adapter,
    model: run.model,
    summary: run.summary,
    result: parseJsonValue(run.result_json),
    error: parseJsonValue(run.error_json),
    usage: parseJsonValue<AgentRunResponse['usage']>(run.usage_json),
    created_at: run.created_at,
    updated_at: run.updated_at,
  };
}

function mapAgentRunRow(row: AgentRunRow): AgentRunRecord {
  return {
    run_id: row.run_id,
    project_id: row.project_id,
    session_id: row.session_id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    api_key_id: row.api_key_id,
    adapter: row.adapter,
    model: row.model,
    status: row.status,
    goal: row.goal,
    summary: row.summary,
    result_json: row.result_json,
    error_json: row.error_json,
    usage_json: row.usage_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseJsonValue<T = unknown>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}
