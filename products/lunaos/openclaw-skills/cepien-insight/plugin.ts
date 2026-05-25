/**
 * Cepien Insight Plugin — OpenClaw integration
 *
 * Bridges Cepien AI product discovery to LunaOS workflow execution.
 * Cepien's public REST API is not yet documented (as of 2026-04-18);
 * this plugin targets a plausible schema and MUST be updated when the
 * official spec is published.
 *
 * Inferred endpoints:
 *   GET  {CEPIEN_API_URL}/insights?project_id=&min_impact=&limit=
 *   GET  {CEPIEN_API_URL}/recommendations/:id
 *
 * LunaOS dispatch endpoint (existing):
 *   POST {LUNAOS_API_URL}/runs  { workflowId, input }
 */

import { cepienFetch, filterByImpact, lunaosDispatch, readConfig } from './helpers';
import type {
    DispatchParams,
    DispatchResult,
    ImpactDimension,
    ListParams,
    ListResult,
    Recommendation,
} from './types';

export { filterByImpact, readConfig } from './helpers';
export type {
    CepienConfig,
    DispatchParams,
    DispatchResult,
    ImpactDimension,
    ImpactScore,
    ListParams,
    ListResult,
    Recommendation,
} from './types';

export default function cepienPlugin(api: any) {
    const cfg = readConfig(api);

    api.registerAgentTool({
        name: 'cepien_list_recommendations',
        description: 'Fetch and filter top-impact product recommendations from Cepien AI.',
        parameters: {
            projectId: { type: 'string', description: 'Cepien project ID', required: true },
            minImpactScore: { type: 'number', description: 'Min score 0-100', default: 70 },
            impactDimension: {
                type: 'string',
                description: 'business | product | usability | combined',
                default: 'combined',
                enum: ['business', 'product', 'usability', 'combined'],
            },
            limit: { type: 'number', description: 'Max results', default: 5 },
        },
        execute: async (params: ListParams): Promise<ListResult | { error: string }> => {
            try {
                const projectId = params.projectId || '';
                const minScore = params.minImpactScore ?? 70;
                const dim = (params.impactDimension || 'combined') as ImpactDimension;
                const limit = params.limit ?? 5;
                const qs = new URLSearchParams({
                    project_id: projectId,
                    min_impact: String(minScore),
                    limit: String(Math.max(limit, 25)),
                });
                const data = await cepienFetch(cfg, `/insights?${qs.toString()}`);
                const recs: Recommendation[] = Array.isArray(data?.recommendations)
                    ? data.recommendations
                    : [];
                const { kept, skipped } = filterByImpact(recs, minScore, dim, limit);
                return {
                    recommendations: kept,
                    summary: { fetched: recs.length, filtered: kept.length, skipped },
                };
            } catch (err: any) {
                return { error: err?.message || String(err) };
            }
        },
    });

    api.registerAgentTool({
        name: 'cepien_get_recommendation',
        description: 'Fetch full detail for a single Cepien recommendation.',
        parameters: {
            id: { type: 'string', description: 'Recommendation ID', required: true },
        },
        execute: async ({ id }: { id: string }) => {
            try {
                return await cepienFetch(cfg, `/recommendations/${encodeURIComponent(id)}`);
            } catch (err: any) {
                return { error: err?.message || String(err) };
            }
        },
    });

    api.registerAgentTool({
        name: 'cepien_dispatch_to_lunaos',
        description:
            'Dispatch a Cepien recommendation as a LunaOS workflow run (downstream execution).',
        parameters: {
            recommendationId: { type: 'string', required: true, description: 'Cepien rec ID' },
            workflowId: { type: 'string', required: true, description: 'LunaOS workflow ID' },
            extraInput: { type: 'object', description: 'Extra input payload merged into run' },
        },
        execute: async (p: DispatchParams): Promise<DispatchResult> => {
            try {
                const rec = await cepienFetch(
                    cfg,
                    `/recommendations/${encodeURIComponent(p.recommendationId)}`,
                );
                const out = await lunaosDispatch(cfg, p.workflowId, {
                    source: 'cepien',
                    recommendation: rec,
                    ...(p.extraInput || {}),
                });
                return { runId: out.runId, status: 'dispatched' };
            } catch (err: any) {
                return { status: 'error', error: err?.message || String(err) };
            }
        },
    });

    api.registerGatewayMethod?.('cepien.health', async ({ respond }: any) => {
        respond(true, {
            configured: Boolean(cfg.apiKey),
            cepienApiUrl: cfg.apiUrl,
            lunaosConfigured: Boolean(cfg.lunaosApiKey),
        });
    });

    console.log('[cepien-insight] plugin v0.1.0 initialized');
}
