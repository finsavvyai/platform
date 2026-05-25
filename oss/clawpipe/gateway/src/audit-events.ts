/** Gateway-side audit event storage + retrieval. */

import type { Env } from './types';

export interface WriteAuditParams {
  projectId: string;
  actorUserId?: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AuditEvent {
  id: string;
  project_id: string;
  actor_user_id: string | null;
  action: string;
  target: string | null;
  metadata: string | null;
  created_at: string;
}

export interface ReadAuditOptions {
  since?: string | null;
  action?: string | null;
  limit?: number;
}

/**
 * Persist one audit event to D1.
 * Fire-and-forget safe: swallows errors so a logging failure never blocks the caller.
 */
export async function writeAuditEvent(env: Env, params: WriteAuditParams): Promise<void> {
  try {
    const id = crypto.randomUUID();
    const meta = params.metadata != null ? JSON.stringify(params.metadata) : null;
    await env.DB.prepare(
      `INSERT INTO audit_events (id, project_id, actor_user_id, action, target, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(id, params.projectId, params.actorUserId ?? null, params.action, params.target ?? null, meta)
      .run();
  } catch {
    // intentionally silent — audit must not break the primary request path
  }
}

/**
 * Retrieve audit events for a project.
 * Cursor pagination: caller passes `since` (created_at of last row) to fetch next page.
 * Returns up to `limit` rows (default 50, max 200) ordered newest-first.
 */
export async function readAuditEvents(
  env: Env,
  projectId: string,
  opts: ReadAuditOptions = {},
): Promise<AuditEvent[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const parts: string[] = [
    'SELECT id, project_id, actor_user_id, action, target, metadata, created_at',
    'FROM audit_events',
    'WHERE project_id = ?',
  ];
  const binds: unknown[] = [projectId];

  if (opts.since) {
    parts.push('AND created_at < ?');
    binds.push(opts.since);
  }
  if (opts.action) {
    parts.push('AND action = ?');
    binds.push(opts.action);
  }

  parts.push('ORDER BY created_at DESC LIMIT ?');
  binds.push(limit);

  const sql = parts.join(' ');
  // D1 prepare().bind() accepts rest args, so spread the binds array.
  const stmt = env.DB.prepare(sql).bind(...binds);
  const result = await stmt.all<AuditEvent>();
  return result.results ?? [];
}
