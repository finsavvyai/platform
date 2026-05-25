import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import cepienPlugin, {
    filterByImpact,
    type Recommendation,
} from '../plugin';

function mkRec(id: string, combined: number, overrides: Partial<Recommendation> = {}): Recommendation {
    return {
        id,
        title: `rec ${id}`,
        impact: { business: combined, product: combined, usability: combined, combined },
        ...overrides,
    };
}

describe('filterByImpact', () => {
    it('keeps recs above threshold on combined dim', () => {
        const recs = [mkRec('a', 90), mkRec('b', 60), mkRec('c', 80)];
        const { kept, skipped } = filterByImpact(recs, 70, 'combined', 10);
        expect(kept.map((r) => r.id)).toEqual(['a', 'c']);
        expect(skipped).toBe(1);
    });

    it('sorts by descending score', () => {
        const recs = [mkRec('low', 71), mkRec('high', 99), mkRec('mid', 85)];
        const { kept } = filterByImpact(recs, 70, 'combined', 10);
        expect(kept.map((r) => r.id)).toEqual(['high', 'mid', 'low']);
    });

    it('respects limit', () => {
        const recs = [mkRec('a', 90), mkRec('b', 85), mkRec('c', 80)];
        const { kept, skipped } = filterByImpact(recs, 70, 'combined', 2);
        expect(kept).toHaveLength(2);
        expect(skipped).toBe(1);
    });

    it('filters per dimension independently', () => {
        const r1 = mkRec('biz', 60, {
            impact: { business: 95, product: 20, usability: 20, combined: 60 },
        });
        const r2 = mkRec('prod', 60, {
            impact: { business: 20, product: 95, usability: 20, combined: 60 },
        });
        expect(filterByImpact([r1, r2], 90, 'business', 10).kept).toEqual([r1]);
        expect(filterByImpact([r1, r2], 90, 'product', 10).kept).toEqual([r2]);
    });

    it('handles empty input', () => {
        const { kept, skipped } = filterByImpact([], 70, 'combined', 10);
        expect(kept).toEqual([]);
        expect(skipped).toBe(0);
    });

    it('handles missing impact gracefully', () => {
        const broken = { id: 'x', title: 't', impact: {} as any };
        const { kept } = filterByImpact([broken], 1, 'combined', 10);
        expect(kept).toEqual([]);
    });
});

describe('cepienPlugin registration', () => {
    let api: any;
    let tools: Record<string, any>;
    let gateways: Record<string, any>;

    beforeEach(() => {
        tools = {};
        gateways = {};
        api = {
            config: { plugins: { entries: {} } },
            registerAgentTool: (t: any) => {
                tools[t.name] = t;
            },
            registerGatewayMethod: (name: string, fn: any) => {
                gateways[name] = fn;
            },
        };
        process.env.CEPIEN_API_KEY = 'test_cepien_key';
        process.env.LUNAOS_API_KEY = 'test_lunaos_key';
    });

    afterEach(() => {
        delete process.env.CEPIEN_API_KEY;
        delete process.env.LUNAOS_API_KEY;
        vi.restoreAllMocks();
    });

    it('registers all three tools and one gateway', () => {
        cepienPlugin(api);
        expect(Object.keys(tools).sort()).toEqual([
            'cepien_dispatch_to_lunaos',
            'cepien_get_recommendation',
            'cepien_list_recommendations',
        ]);
        expect(gateways['cepien.health']).toBeDefined();
    });

    it('list tool filters recommendations from API', async () => {
        const apiRecs = [mkRec('hi', 95), mkRec('mid', 80), mkRec('lo', 40)];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ recommendations: apiRecs }),
            }),
        );
        cepienPlugin(api);
        const res = await tools.cepien_list_recommendations.execute({
            projectId: 'p1',
            minImpactScore: 70,
            limit: 5,
        });
        expect(res.error).toBeUndefined();
        expect(res.recommendations.map((r: Recommendation) => r.id)).toEqual(['hi', 'mid']);
        expect(res.summary).toEqual({ fetched: 3, filtered: 2, skipped: 1 });
    });

    it('list tool surfaces api errors as { error }', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
                text: async () => 'upstream down',
            }),
        );
        cepienPlugin(api);
        const res = await tools.cepien_list_recommendations.execute({ projectId: 'p1' });
        expect(res.error).toMatch(/Cepien API 500/);
    });

    it('list tool reports missing API key', async () => {
        delete process.env.CEPIEN_API_KEY;
        cepienPlugin(api);
        const res = await tools.cepien_list_recommendations.execute({ projectId: 'p1' });
        expect(res.error).toMatch(/CEPIEN_API_KEY/);
    });

    it('dispatch tool fetches rec then posts run to LunaOS', async () => {
        const rec = mkRec('r1', 88);
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => rec })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'run_xyz' }) });
        vi.stubGlobal('fetch', fetchMock);
        cepienPlugin(api);
        const res = await tools.cepien_dispatch_to_lunaos.execute({
            recommendationId: 'r1',
            workflowId: 'wf_pr',
        });
        expect(res).toEqual({ runId: 'run_xyz', status: 'dispatched' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [, dispatchCall] = fetchMock.mock.calls;
        expect(dispatchCall[0]).toContain('/runs');
        expect(JSON.parse(dispatchCall[1].body)).toMatchObject({
            workflowId: 'wf_pr',
            input: { source: 'cepien', recommendation: rec },
        });
    });

    it('dispatch tool returns error status on LunaOS failure', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => mkRec('r1', 80) })
            .mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'forbidden' });
        vi.stubGlobal('fetch', fetchMock);
        cepienPlugin(api);
        const res = await tools.cepien_dispatch_to_lunaos.execute({
            recommendationId: 'r1',
            workflowId: 'wf_pr',
        });
        expect(res.status).toBe('error');
        expect(res.error).toMatch(/LunaOS dispatch 403/);
    });

    it('list tool applies defaults when params omitted', async () => {
        const apiRecs = [mkRec('hi', 95), mkRec('mid', 72)];
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ recommendations: apiRecs }),
            }),
        );
        cepienPlugin(api);
        const res = await tools.cepien_list_recommendations.execute({});
        expect(res.error).toBeUndefined();
        expect(res.summary.fetched).toBe(2);
        expect(res.summary.filtered).toBe(2);
    });

    it('list tool handles non-array recommendations payload', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: 'wrong-shape' }) }),
        );
        cepienPlugin(api);
        const res = await tools.cepien_list_recommendations.execute({ projectId: 'p1' });
        expect(res.recommendations).toEqual([]);
        expect(res.summary.fetched).toBe(0);
    });

    it('get tool returns recommendation detail on success', async () => {
        const rec = mkRec('r42', 77);
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => rec }));
        cepienPlugin(api);
        const res = await tools.cepien_get_recommendation.execute({ id: 'r42' });
        expect(res).toEqual(rec);
    });

    it('get tool surfaces errors with correct URL encoding', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: false, status: 404, text: async () => 'not found' });
        vi.stubGlobal('fetch', fetchMock);
        cepienPlugin(api);
        const res = await tools.cepien_get_recommendation.execute({ id: 'weird id/123' });
        expect(res.error).toMatch(/Cepien API 404/);
        expect(fetchMock.mock.calls[0][0]).toContain('weird%20id%2F123');
    });

    it('dispatch tool merges extraInput into run payload', async () => {
        const rec = mkRec('r1', 88);
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({ ok: true, json: async () => rec })
            .mockResolvedValueOnce({ ok: true, json: async () => ({ runId: 'run_merged' }) });
        vi.stubGlobal('fetch', fetchMock);
        cepienPlugin(api);
        const res = await tools.cepien_dispatch_to_lunaos.execute({
            recommendationId: 'r1',
            workflowId: 'wf_pr',
            extraInput: { priority: 'high', requester: 'user_42' },
        });
        expect(res.status).toBe('dispatched');
        const dispatchBody = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(dispatchBody.input).toMatchObject({
            source: 'cepien',
            priority: 'high',
            requester: 'user_42',
        });
    });

    it('health gateway reports missing config when keys absent', async () => {
        delete process.env.CEPIEN_API_KEY;
        delete process.env.LUNAOS_API_KEY;
        cepienPlugin(api);
        const replies: any[] = [];
        await gateways['cepien.health']({
            respond: (ok: boolean, body: any) => replies.push({ ok, body }),
        });
        expect(replies[0].body).toMatchObject({ configured: false, lunaosConfigured: false });
    });

    it('health gateway reports config state', async () => {
        cepienPlugin(api);
        const fn = gateways['cepien.health'];
        const replies: any[] = [];
        await fn({ respond: (ok: boolean, body: any) => replies.push({ ok, body }) });
        expect(replies[0].ok).toBe(true);
        expect(replies[0].body).toMatchObject({
            configured: true,
            lunaosConfigured: true,
        });
    });
});
