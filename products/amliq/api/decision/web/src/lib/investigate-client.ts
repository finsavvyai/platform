/**
 * Fetch wrapper for the Investigate decision history surface.
 *
 * Stub mode: when `BRAIN_API_URL` is unset (default in dev), each function
 * returns a fixture so the UI demos end-to-end without a live deployment.
 * Fixtures contain NO real PII — only stable hashed subject ids,
 * structural attributes, and synthetic decision_ids.
 *
 * Round-2 rule: no `@finsavvyai/*` imports here. Round-4 rule: this
 * package is not in the pnpm workspace, so fetch lives in this file.
 *
 * Tested in `investigate-client.test.ts`.
 */
import type {
  AuditListApi,
  DecisionDetailApi,
  DecisionListApi,
} from './types.js';
import {
  buildAuditFixture,
  buildDetailFixture,
  buildListFixture,
} from './investigate-fixtures.js';

export interface InvestigateClientOptions {
  readonly baseUrl?: string;
  readonly token?: string;
  readonly tenantId: string;
  readonly fetchImpl?: typeof fetch;
}

const callJson = async <T>(
  url: string,
  opts: InvestigateClientOptions,
): Promise<T | { ok: false; error: string }> => {
  const fx = opts.fetchImpl ?? fetch;
  try {
    const res = await fx(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-Tenant-Id': opts.tenantId,
        ...(opts.token
          ? { Authorization: `Bearer ${opts.token}` }
          : {}),
      },
    });
    if (!res.ok) {
      return { ok: false, error: `http_${res.status}` };
    }
    return (await res.json()) as T;
  } catch {
    return { ok: false, error: 'network_error' };
  }
};

export const listDecisions = async (
  opts: InvestigateClientOptions,
): Promise<DecisionListApi> => {
  if (!opts.baseUrl) return buildListFixture(opts.tenantId);
  return callJson<DecisionListApi>(
    `${opts.baseUrl}/v1/aml/decision/history`,
    opts,
  );
};

export const getDecision = async (
  id: string,
  opts: InvestigateClientOptions,
): Promise<DecisionDetailApi> => {
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'missing_decision_id' };
  }
  if (!opts.baseUrl) return buildDetailFixture(trimmed, opts.tenantId);
  return callJson<DecisionDetailApi>(
    `${opts.baseUrl}/v1/aml/decision/${encodeURIComponent(trimmed)}`,
    opts,
  );
};

export const listAudit = async (
  opts: InvestigateClientOptions,
): Promise<AuditListApi> => {
  if (!opts.baseUrl) return buildAuditFixture(opts.tenantId);
  return callJson<AuditListApi>(
    `${opts.baseUrl}/v1/aml/audit`,
    opts,
  );
};
