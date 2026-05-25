/**
 * GET /v1/billing/portal
 *
 * Looks up the project's LS customer ID and asks LemonSqueezy for a signed
 * customer-portal URL the dashboard can redirect to.
 *
 * Auth is enforced by the surrounding router; `projectId` is trusted.
 */

import type { Env } from '../types';
import { getCustomerPortalUrl } from './lemonsqueezy-client';

interface ProjectRow {
  ls_customer_id: string | null;
}

export async function handlePortal(
  env: Env,
  projectId: string,
): Promise<Response> {
  const row = await env.DB
    .prepare('SELECT ls_customer_id FROM projects WHERE id = ?')
    .bind(projectId)
    .first<ProjectRow>();

  const customerId = row?.ls_customer_id;
  if (!customerId) {
    return Response.json(
      { error: 'no_active_subscription' },
      { status: 404 },
    );
  }

  try {
    const url = await getCustomerPortalUrl(env, customerId);
    return Response.json({ url }, { status: 200 });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: 'lemonsqueezy_unavailable', detail },
      { status: 502 },
    );
  }
}
