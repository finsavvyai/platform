/**
 * GET /v1/finops/by-user — cost attribution per project member.
 *
 * Visibility scope: requests made with member-bound API keys only.
 * Requests using ad-hoc project keys have user_id = NULL and are
 * aggregated under the "Unattributed" row.
 */

import type { Env } from './types';
import { getAuthUser, checkProjectAccess } from './auth/rbac';
import { buildUserRows, buildTopModels } from './finops-by-user-sql';

export interface UserCostRow {
  user_id: string | null;
  email: string;
  name: string;
  total_cost: number;
  total_requests: number;
  top_models: Array<{ model: string; cost: number }>;
}

interface RawRow {
  user_id: string | null;
  email: string | null;
  name: string | null;
  total_cost: number;
  total_requests: number;
}

interface ModelRow {
  user_id: string | null;
  model: string;
  cost: number;
}

/** GET /v1/finops/by-user?projectId=...&from=...&to=... */
export async function handleFinopsByUser(
  request: Request, env: Env,
): Promise<Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 });

  const isAdmin = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!isAdmin) return Response.json({ error: 'Project admin access required' }, { status: 403 });

  const from = url.searchParams.get('from') ?? dateOffset(-30);
  const to = url.searchParams.get('to') ?? dateOffset(0);

  const [userRows, modelRows] = await Promise.all([
    buildUserRows(env, projectId, from, to),
    buildTopModels(env, projectId, from, to),
  ]);

  const rows = mergeRows(userRows as RawRow[], modelRows as ModelRow[]);
  return Response.json({ projectId, from, to, rows });
}

function mergeRows(userRows: RawRow[], modelRows: ModelRow[]): UserCostRow[] {
  const modelsByUser = new Map<string | null, Array<{ model: string; cost: number }>>();
  for (const m of modelRows) {
    const key = m.user_id ?? null;
    const list = modelsByUser.get(key) ?? [];
    list.push({ model: m.model, cost: m.cost });
    modelsByUser.set(key, list);
  }

  return userRows.map((r) => ({
    user_id: r.user_id ?? null,
    email: r.email ?? 'Unattributed',
    name: r.name ?? 'Unattributed',
    total_cost: r.total_cost,
    total_requests: r.total_requests,
    top_models: (modelsByUser.get(r.user_id ?? null) ?? []).slice(0, 3),
  }));
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
