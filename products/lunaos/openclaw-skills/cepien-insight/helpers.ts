import type { CepienConfig, ImpactDimension, Recommendation } from './types';

export function readConfig(api: any): CepienConfig {
    const entry = api?.config?.plugins?.entries?.['cepien-insight']?.config || {};
    return {
        apiUrl: entry.apiUrl || process.env.CEPIEN_API_URL || 'https://platform.cepien.ai/api/v1',
        apiKey: entry.apiKey || process.env.CEPIEN_API_KEY || '',
        lunaosApiUrl: entry.lunaosApiUrl || process.env.LUNAOS_API_URL || 'https://api.lunaos.ai',
        lunaosApiKey: entry.lunaosApiKey || process.env.LUNAOS_API_KEY || '',
    };
}

function score(rec: Recommendation, dim: ImpactDimension): number {
    return rec.impact?.[dim] ?? 0;
}

export function filterByImpact(
    recs: Recommendation[],
    minScore: number,
    dim: ImpactDimension,
    limit: number,
): { kept: Recommendation[]; skipped: number } {
    const eligible = recs.filter((r) => score(r, dim) >= minScore);
    eligible.sort((a, b) => score(b, dim) - score(a, dim));
    const kept = eligible.slice(0, Math.max(0, limit));
    return { kept, skipped: recs.length - kept.length };
}

export async function cepienFetch(
    cfg: CepienConfig,
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: unknown,
) {
    if (!cfg.apiKey) throw new Error('CEPIEN_API_KEY not configured');
    const res = await fetch(`${cfg.apiUrl}${path}`, {
        method,
        headers: {
            'Authorization': `Bearer ${cfg.apiKey}`,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Cepien API ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
}

export async function lunaosDispatch(
    cfg: CepienConfig,
    workflowId: string,
    input: unknown,
): Promise<{ runId: string }> {
    if (!cfg.lunaosApiKey) throw new Error('LUNAOS_API_KEY not configured');
    const res = await fetch(`${cfg.lunaosApiUrl}/runs`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${cfg.lunaosApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workflowId, input }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`LunaOS dispatch ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json() as Promise<{ runId: string }>;
}
