/** API key authentication and project validation. */

import type { Env } from './types';

export interface AuthResult {
  valid: boolean;
  projectId: string | null;
  /** Resolved user_id when the key is bound to a project member; null otherwise. */
  userId: string | null;
  error: string | null;
}

/** Validate an incoming request's API key and project ID. */
export async function authenticate(request: Request, env: Env): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false, projectId: null, userId: null, error: 'Missing Authorization header' };
  }

  const apiKey = authHeader.slice(7);
  if (!apiKey || apiKey.length < 8) {
    return { valid: false, projectId: null, userId: null, error: 'Invalid API key format' };
  }

  const projectId = request.headers.get('X-Project-Id');
  if (!projectId) {
    return { valid: false, projectId: null, userId: null, error: 'Missing X-Project-Id header' };
  }

  // Hash the API key and look up in D1
  const keyHash = await hashKey(apiKey);

  // Check member-bound api_keys table first (carries member_user_id).
  const memberKey = await env.DB.prepare(
    'SELECT project_id, member_user_id FROM api_keys WHERE key_hash = ?',
  ).bind(keyHash).first<{ project_id: string; member_user_id: string | null }>();

  if (memberKey && memberKey.project_id === projectId) {
    return { valid: true, projectId: memberKey.project_id, userId: memberKey.member_user_id ?? null, error: null };
  }

  // Fall back to project-level key stored on the projects row.
  const row = await env.DB.prepare(
    'SELECT id FROM projects WHERE api_key_hash = ?',
  ).bind(keyHash).first<{ id: string }>();

  if (!row) {
    return { valid: false, projectId: null, userId: null, error: 'Invalid API key' };
  }

  // Project-level keys have no member binding — user_id intentionally NULL.
  return { valid: true, projectId: row.id, userId: null, error: null };
}

/** SHA-256 hash of an API key (never store plaintext). */
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
