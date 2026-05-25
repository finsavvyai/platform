/** GET /v1/webhooks/dlq + POST /v1/webhooks/dlq/:id/replay */

import type { Env } from './types';
import { replayDelivery, type DeliveryRow } from './webhook-dlq';

const LIST_LIMIT = 100;

export async function listDeadDeliveries(env: Env, projectId: string): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT id, webhook_id, project_id, event, attempts, max_attempts,
            status, last_error, next_retry_at, created_at, updated_at
       FROM webhook_deliveries
      WHERE project_id = ? AND status IN ('dead', 'pending')
      ORDER BY updated_at DESC
      LIMIT ?`,
  ).bind(projectId, LIST_LIMIT).all<DeliveryRow & { created_at: string; updated_at: string }>();
  return Response.json({ deliveries: rows.results ?? [] });
}

export async function handleReplay(
  env: Env, projectId: string, deliveryId: string,
): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT project_id FROM webhook_deliveries WHERE id = ?',
  ).bind(deliveryId).first<{ project_id: string }>();
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  if (row.project_id !== projectId) return Response.json({ error: 'forbidden' }, { status: 403 });
  const updated = await replayDelivery(env, deliveryId);
  return Response.json({ delivery: updated }, { status: 200 });
}

/** Route entry: returns null if path doesn't match. */
export async function routeWebhookDlq(
  request: Request, env: Env, path: string, projectId: string,
): Promise<Response | null> {
  if (path === '/v1/webhooks/dlq' && request.method === 'GET') {
    return await listDeadDeliveries(env, projectId);
  }
  const replayMatch = path.match(/^\/v1\/webhooks\/dlq\/([^/]+)\/replay$/);
  if (replayMatch && request.method === 'POST') {
    return await handleReplay(env, projectId, replayMatch[1]);
  }
  return null;
}
