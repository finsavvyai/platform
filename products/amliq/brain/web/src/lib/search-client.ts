/**
 * Browser/server-fetch client for the Brain search API.
 *
 * Stub mode: when `BRAIN_API_URL` is unset (default in dev), the client
 * returns a fixture instead of hitting a real endpoint. This lets the
 * citation UI demo end-to-end without a live deployment.
 *
 * Pure utility; tested in `search-client.test.ts`.
 */
import type {
  SearchApiResponse,
  SearchResponse,
} from './types.js';

export interface SearchClientOptions {
  /** Brain API base URL, e.g. https://brain.amliq.dev. */
  readonly baseUrl?: string;
  /** Bearer token for local dev. Never log this. */
  readonly token?: string;
  /** Tenant id to scope the query (mesh §2 TenantContext). */
  readonly tenantId: string;
  /** Optional fetch impl (test injection). */
  readonly fetchImpl?: typeof fetch;
}

export const buildFixture = (q: string): SearchResponse => ({
  ok: true,
  query: q,
  latencyMs: 12,
  results: [
    {
      doc_id: 'fincen-2024-a006',
      snippet:
        `FinCEN advises financial institutions on suspicious activity ` +
        `related to ${q} and recommends enhanced due diligence.`,
      score: 0.92,
      citations: [
        {
          doc_id: 'fincen-2024-a006',
          span_start: 64,
          span_end: 64 + q.length,
          source: 'fincen_rss',
        },
      ],
    },
    {
      doc_id: 'ffiec-bsa-aml-2024',
      snippet:
        `FFIEC BSA/AML examination manual discusses ${q} red flags ` +
        `in correspondent banking relationships.`,
      score: 0.78,
      citations: [
        {
          doc_id: 'ffiec-bsa-aml-2024',
          span_start: 44,
          span_end: 44 + q.length,
          source: 'ffiec_pdf',
        },
      ],
    },
  ],
});

export const runSearch = async (
  q: string,
  opts: SearchClientOptions,
): Promise<SearchApiResponse> => {
  const trimmed = q.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'missing_query' };
  }
  if (!opts.baseUrl) {
    return buildFixture(trimmed);
  }
  const fx = opts.fetchImpl ?? fetch;
  try {
    const res = await fx(`${opts.baseUrl}/v1/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token
          ? { Authorization: `Bearer ${opts.token}` }
          : {}),
      },
      body: JSON.stringify({
        q: trimmed,
        tenant_id: opts.tenantId,
      }),
    });
    const j = (await res.json()) as SearchApiResponse;
    return j;
  } catch {
    return { ok: false, error: 'network_error' };
  }
};

/**
 * Source label → human-friendly display string. Pure.
 */
export const sourceLabel = (source: string): string => {
  switch (source) {
    case 'fincen_rss':
      return 'FinCEN';
    case 'ffiec_pdf':
      return 'FFIEC';
    case 'ofac':
      return 'OFAC';
    case 'ecb':
      return 'ECB';
    case 'fca':
      return 'FCA';
    case 'internal':
      return 'Internal';
    default:
      return source;
  }
};
