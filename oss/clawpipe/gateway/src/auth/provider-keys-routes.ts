/** HTTP handlers for per-project provider key management. */

import type { Env } from '../types';
import { getAuthUser, checkProjectAccess } from './rbac';
import { storeProviderKey, deleteProviderKey } from './provider-keys';

const VALID_PROVIDERS = new Set([
  'openai', 'anthropic', 'deepseek', 'groq', 'gemini', 'mistral',
  'together', 'fireworks', 'openrouter', 'perplexity', 'cohere',
  'ai21', 'cerebras', 'replicate', 'huggingface', 'writer',
  'databricks', 'azure-openai', 'bedrock', 'vertex', 'xai',
]);

async function requireAdmin(
  request: Request,
  env: Env,
  projectId: string,
): Promise<{ userId: string } | Response> {
  const user = await getAuthUser(request, env);
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const project = await env.DB.prepare(
    'SELECT id FROM projects WHERE id = ?',
  ).bind(projectId).first<{ id: string }>();
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 });
  const ok = await checkProjectAccess(env, user.sub, projectId, 'admin');
  if (!ok) return Response.json({ error: 'Forbidden' }, { status: 403 });
  return { userId: user.sub };
}

/** PUT /v1/projects/:id/provider-keys/:provider — store or replace a key. */
export async function handlePutProviderKey(
  request: Request,
  env: Env,
  projectId: string,
  provider: string,
): Promise<Response> {
  const check = await requireAdmin(request, env, projectId);
  if (check instanceof Response) return check;

  if (!VALID_PROVIDERS.has(provider)) {
    return Response.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  }
  if (!env.PROVIDER_KEY_ENCRYPTION_SECRET) {
    return Response.json({ error: 'Encryption not configured on this gateway' }, { status: 503 });
  }

  let body: { value?: string };
  try { body = await request.json() as typeof body; } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body.value !== 'string' || !body.value.trim()) {
    return Response.json({ error: 'value must be a non-empty string' }, { status: 400 });
  }

  await storeProviderKey(env, projectId, provider, body.value.trim());
  return Response.json({ ok: true, provider }, { status: 201 });
}

/** DELETE /v1/projects/:id/provider-keys/:provider — remove a key. */
export async function handleDeleteProviderKey(
  request: Request,
  env: Env,
  projectId: string,
  provider: string,
): Promise<Response> {
  const check = await requireAdmin(request, env, projectId);
  if (check instanceof Response) return check;

  await deleteProviderKey(env, projectId, provider);
  return new Response(null, { status: 204 });
}

interface ProviderKeyRow {
  provider: string;
  created_at: string;
}

/** GET /v1/projects/:id/provider-keys — list configured providers (no plaintext). */
export async function handleListProviderKeys(
  request: Request,
  env: Env,
  projectId: string,
): Promise<Response> {
  const check = await requireAdmin(request, env, projectId);
  if (check instanceof Response) return check;

  const rows = await env.DB.prepare(
    'SELECT provider, created_at FROM provider_keys WHERE project_id = ? ORDER BY provider ASC',
  ).bind(projectId).all<ProviderKeyRow>();

  return Response.json({ providers: rows.results ?? [] });
}
