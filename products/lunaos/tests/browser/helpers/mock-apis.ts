import type { Page, Route } from '@playwright/test';

export interface MockApiOptions {
    apiBaseUrl?: string;
    userId?: string;
    workflowCount?: number;
}

function json(route: Route, status: number, body: unknown) {
    return route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
    });
}

export async function installLunaApiMocks(page: Page, opts: MockApiOptions = {}) {
    const base = opts.apiBaseUrl || 'https://api.lunaos.ai';
    const userId = opts.userId || 'user_test_1';
    const n = opts.workflowCount ?? 3;

    await page.route(`${base}/auth/me`, (r) => json(r, 200, { id: userId, email: 'test@lunaos.ai' }));

    await page.route(`${base}/workflows*`, (r) =>
        json(r, 200, {
            data: Array.from({ length: n }, (_, i) => ({
                id: `wf_${i + 1}`,
                name: `Workflow ${i + 1}`,
                status: i === 0 ? 'active' : 'draft',
                updatedAt: new Date(Date.now() - i * 86400e3).toISOString(),
            })),
        }),
    );

    await page.route(new RegExp(`${escapeRe(base)}/workflows/[^/]+$`), (r) =>
        json(r, 200, {
            id: 'wf_1',
            name: 'Workflow 1',
            definition: { nodes: [], edges: [] },
        }),
    );

    await page.route(`${base}/runs`, (r) =>
        json(r, 201, { runId: 'run_test_' + Date.now(), status: 'queued' }),
    );

    await page.route(`${base}/billing/subscription`, (r) =>
        json(r, 200, { plan: 'pro', status: 'active', renewal_date: '2027-01-01' }),
    );

    await page.route(`${base}/openclaw/tools`, (r) =>
        json(r, 200, { tools: ['luna_run', 'luna_search', 'cepien_list_recommendations'] }),
    );

    await page.route(`${base}/rag/ingest`, (r) =>
        json(r, 200, { ingested: 42, bySource: { analytics: 20, support: 12, feedback: 10 } }),
    );

    await page.route(`${base}/rag/cluster`, (r) =>
        json(r, 200, {
            clusters: [
                {
                    id: 'c1',
                    title: 'Onboarding drop-off',
                    tags: ['signup'],
                    evidence: ['rate=37%'],
                    cluster_size: 8,
                },
            ],
        }),
    );
}

export async function installFailureMocks(page: Page, apiBaseUrl = 'https://api.lunaos.ai') {
    await page.route(`${apiBaseUrl}/**`, (r) =>
        json(r, 503, { error: 'service unavailable', correlationId: 'cid_test' }),
    );
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
