/**
 * ll-insights plugin — OpenClaw integration
 *
 * Orchestrates:
 *   rag-ingest → cluster-detect → impact-score → emit-backlog
 *
 * LunaOS API contract (existing endpoints):
 *   POST /rag/ingest            { sources, windowDays, indexName }
 *   POST /rag/cluster           { indexName, minClusterSize }
 *   POST /runs                  { workflowId, input }
 *
 * Scoring is done locally (no API round-trip) via ./scoring.ts so the
 * primitive is identical to the engine impact-scoring module.
 */

import { filterAndRank, scoreIssues } from './scoring';
import type {
    ClusteredIssue,
    EmitParams,
    ImpactDimension,
    InsightsConfig,
    IngestParams,
    IngestResult,
    ScoreParams,
    ScoreResult,
} from './types';

function readConfig(api: any): InsightsConfig {
    const entry = api?.config?.plugins?.entries?.['ll-insights']?.config || {};
    return {
        lunaosApiUrl: entry.apiUrl || process.env.LUNAOS_API_URL || 'https://api.lunaos.ai',
        lunaosApiKey: entry.apiKey || process.env.LUNAOS_API_KEY || '',
        ragIndexName: entry.ragIndexName || process.env.RAG_INDEX_NAME || 'insights',
    };
}

async function callLuna(cfg: InsightsConfig, path: string, body: unknown) {
    if (!cfg.lunaosApiKey) throw new Error('LUNAOS_API_KEY not configured');
    const res = await fetch(`${cfg.lunaosApiUrl}${path}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${cfg.lunaosApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`LunaOS ${path} ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}

export default function llInsightsPlugin(api: any) {
    const cfg = readConfig(api);

    api.registerAgentTool({
        name: 'll_ingest',
        description: 'Ingest analytics/support/feedback into luna-rag vector index.',
        parameters: {
            sources: { type: 'array', description: 'Source names', required: true },
            windowDays: { type: 'number', description: 'Lookback window', default: 30 },
        },
        execute: async (p: IngestParams): Promise<IngestResult | { error: string }> => {
            try {
                const data = await callLuna(cfg, '/rag/ingest', {
                    sources: p.sources,
                    windowDays: p.windowDays ?? 30,
                    indexName: cfg.ragIndexName,
                });
                return {
                    ingested: Number(data?.ingested) || 0,
                    bySource: data?.bySource || {},
                } as IngestResult;
            } catch (err: any) {
                return { error: err?.message || String(err) };
            }
        },
    });

    api.registerAgentTool({
        name: 'll_cluster',
        description: 'Cluster ingested issues via graph-rag community detection.',
        parameters: {
            minClusterSize: { type: 'number', description: 'Min items per cluster', default: 3 },
        },
        execute: async ({ minClusterSize = 3 }: { minClusterSize?: number }) => {
            try {
                const data = await callLuna(cfg, '/rag/cluster', {
                    indexName: cfg.ragIndexName,
                    minClusterSize,
                });
                const clusters: ClusteredIssue[] = Array.isArray(data?.clusters)
                    ? data.clusters
                    : [];
                return { clusters, count: clusters.length };
            } catch (err: any) {
                return { error: err?.message || String(err) };
            }
        },
    });

    api.registerAgentTool({
        name: 'll_score',
        description: 'Apply impact scoring + filter + rank over clustered issues.',
        parameters: {
            issues: { type: 'array', required: true, description: 'ClusteredIssue[]' },
            rawScores: { type: 'array', required: true, description: 'Raw dim scores per issue' },
            weights: { type: 'object', description: 'Impact weights override' },
            minScore: { type: 'number', default: 70 },
            dimension: { type: 'string', default: 'combined' },
            limit: { type: 'number', default: 20 },
        },
        execute: async (
            p: ScoreParams & { rawScores: any[] },
        ): Promise<ScoreResult | { error: string }> => {
            try {
                const scored = scoreIssues(p.issues, p.rawScores || [], p.weights);
                const minScore = p.minScore ?? 70;
                const dim = (p.dimension || 'combined') as ImpactDimension;
                const limit = p.limit ?? 20;
                const backlog = filterAndRank(scored, minScore, dim, limit);
                return {
                    backlog,
                    summary: {
                        scored: scored.length,
                        filtered: scored.length - backlog.length,
                        emitted: backlog.length,
                    },
                };
            } catch (err: any) {
                return { error: err?.message || String(err) };
            }
        },
    });

    api.registerAgentTool({
        name: 'll_emit',
        description: 'Emit backlog to JSON, webhook, LunaOS workflow, or stdout.',
        parameters: {
            backlog: { type: 'array', required: true },
            emitTo: { type: 'string', required: true, enum: ['json', 'webhook', 'workflow', 'stdout'] },
            targetWorkflowId: { type: 'string' },
            webhookUrl: { type: 'string' },
        },
        execute: async (p: EmitParams) => {
            try {
                if (p.emitTo === 'workflow') {
                    if (!p.targetWorkflowId) throw new Error('targetWorkflowId required for workflow emit');
                    const runs: string[] = [];
                    for (const item of p.backlog.slice(0, 3)) {
                        const out = await callLuna(cfg, '/runs', {
                            workflowId: p.targetWorkflowId,
                            input: { source: 'll-insights', item },
                        });
                        if (out?.runId) runs.push(out.runId);
                    }
                    return { emitted: runs.length, runs };
                }
                if (p.emitTo === 'webhook') {
                    if (!p.webhookUrl) throw new Error('webhookUrl required');
                    const res = await fetch(p.webhookUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ backlog: p.backlog }),
                    });
                    return { emitted: p.backlog.length, status: res.status };
                }
                if (p.emitTo === 'stdout') {
                    console.log(JSON.stringify({ backlog: p.backlog }, null, 2));
                    return { emitted: p.backlog.length, sink: 'stdout' };
                }
                return { emitted: p.backlog.length, sink: 'json', backlog: p.backlog };
            } catch (err: any) {
                return { error: err?.message || String(err) };
            }
        },
    });

    api.registerGatewayMethod?.('llInsights.health', async ({ respond }: any) => {
        respond(true, {
            configured: Boolean(cfg.lunaosApiKey),
            indexName: cfg.ragIndexName,
        });
    });

    console.log('[ll-insights] plugin v0.1.0 initialized — 4 tools registered');
}
