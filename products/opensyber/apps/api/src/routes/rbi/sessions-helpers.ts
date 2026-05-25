// @ts-nocheck
/**
 * Shared helpers for /api/rbi/sessions handlers.
 *
 * Kept separate so sessions.ts stays under the 200-line file cap. Pure
 * functions only — no Hono routing, no DB writes.
 */

import { KasmClient, KasmApiError, KasmTimeoutError } from '@opensyber/rbi-orchestrator';
import { decrypt } from '../../utils/encryption.js';
import type { Env } from '../../types.js';
import type { TfRbiTenant } from '@opensyber/db';

export function aadFor(tenantId: string): string {
  return `rbi:${tenantId}:kasm-api-secret`;
}

export interface KasmErrorPayload {
  status: 502 | 504;
  body: Record<string, unknown>;
}

export function kasmErrorResponse(err: unknown): KasmErrorPayload {
  if (err instanceof KasmTimeoutError) {
    return { status: 504, body: { error: 'kasm_timeout', message: err.message } };
  }
  if (err instanceof KasmApiError) {
    return {
      status: 502,
      body: { error: 'kasm_upstream_error', status: err.status, message: err.message },
    };
  }
  return {
    status: 502,
    body: {
      error: 'kasm_unknown',
      message: err instanceof Error ? err.message : 'unknown Kasm error',
    },
  };
}

/**
 * Decrypt the per-tenant Kasm api_key_secret using ENCRYPTION_KEY +
 * tenant-bound AAD. Returns `null` when the ciphertext is unreadable
 * (treated by callers as a degraded path; never fall back to plaintext).
 */
export async function loadKasmSecret(
  env: Env,
  tenant: Pick<TfRbiTenant, 'id' | 'apiKeySecretEncrypted'>,
): Promise<string | null> {
  try {
    return await decrypt(tenant.apiKeySecretEncrypted, env.ENCRYPTION_KEY, aadFor(tenant.id));
  } catch {
    return null;
  }
}

export function makeKasmClient(
  tenant: Pick<TfRbiTenant, 'kasmApiUrl' | 'kasmApiKeyId'>,
  apiKeySecret: string,
): KasmClient {
  return new KasmClient({
    apiUrl: tenant.kasmApiUrl,
    apiKey: tenant.kasmApiKeyId,
    apiKeySecret,
  });
}
