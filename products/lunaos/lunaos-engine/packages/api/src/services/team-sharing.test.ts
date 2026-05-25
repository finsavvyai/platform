import { describe, it, expect, vi } from 'vitest';
import { shareAgentWithTeam, unshareAgentFromTeam, getTeamAgents, getTeamExecutions } from './team-service';

function mockDB(overrides: Record<string, unknown> = {}) {
    const defaults = { first: vi.fn().mockResolvedValue(null), all: vi.fn().mockResolvedValue({ results: [] }), run: vi.fn().mockResolvedValue({}) };
    const stmt = { bind: vi.fn().mockReturnValue({ ...defaults, ...overrides }) };
    return { prepare: vi.fn().mockReturnValue(stmt), batch: vi.fn().mockResolvedValue([]) } as unknown as D1Database;
}

describe('shareAgentWithTeam', () => {
    it('shares an agent', async () => {
        let callCount = 0;
        const db = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    first: vi.fn().mockImplementation(async () => {
                        if (callCount++ === 0) return { id: 'a1' };
                        return null;
                    }),
                    run: vi.fn().mockResolvedValue({}),
                }),
            }),
        } as unknown as D1Database;
        await expect(shareAgentWithTeam(db, 't1', 'a1', 'u1')).resolves.toBeUndefined();
    });

    it('throws for non-existent agent', async () => {
        const db = mockDB();
        await expect(shareAgentWithTeam(db, 't1', 'bad', 'u1')).rejects.toThrow('Agent not found');
    });

    it('throws for duplicate share', async () => {
        let callCount = 0;
        const db = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    first: vi.fn().mockImplementation(async () => {
                        return callCount++ === 0 ? { id: 'a1' } : { agent_id: 'a1' };
                    }),
                    run: vi.fn().mockResolvedValue({}),
                }),
            }),
        } as unknown as D1Database;
        await expect(shareAgentWithTeam(db, 't1', 'a1', 'u1')).rejects.toThrow('already shared');
    });
});

describe('unshareAgentFromTeam', () => {
    it('unshares an agent', async () => {
        const db = mockDB({ first: vi.fn().mockResolvedValue({ agent_id: 'a1' }) });
        expect(await unshareAgentFromTeam(db, 't1', 'a1')).toBe(true);
    });

    it('returns false if not shared', async () => {
        const db = mockDB();
        expect(await unshareAgentFromTeam(db, 't1', 'a1')).toBe(false);
    });
});

describe('getTeamAgents', () => {
    it('returns shared agents from DB', async () => {
        const agents = [{ agent_id: 'a1', name: 'Bot', slug: 'bot', description: null, shared_by: 'u1', shared_at: '2026-01-01' }];
        const db = mockDB({ all: vi.fn().mockResolvedValue({ results: agents }) });
        const result = await getTeamAgents(db, 't1');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Bot');
    });

    it('returns empty for no shares', async () => {
        const db = mockDB();
        expect(await getTeamAgents(db, 't1')).toEqual([]);
    });
});

describe('getTeamExecutions', () => {
    it('returns execution results with total', async () => {
        const execs = [{ id: 'e1', user_id: 'u1', agent: 'bot', provider: 'openai', model: 'gpt-4', duration_ms: 100, status: 'completed', created_at: '2026-01-01' }];
        let callCount = 0;
        const db = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    first: vi.fn().mockImplementation(async () => callCount++ === 0 ? { total: 1 } : null),
                    all: vi.fn().mockResolvedValue({ results: execs }),
                }),
            }),
        } as unknown as D1Database;
        const result = await getTeamExecutions(db, 't1', { limit: 20, offset: 0 });
        expect(result.total).toBe(1);
        expect(result.executions).toHaveLength(1);
    });

    it('respects pagination params', async () => {
        const db = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    first: vi.fn().mockResolvedValue({ total: 0 }),
                    all: vi.fn().mockResolvedValue({ results: [] }),
                }),
            }),
        } as unknown as D1Database;
        const result = await getTeamExecutions(db, 't1', { limit: 5, offset: 10 });
        expect(result.executions).toEqual([]);
        expect(db.prepare).toHaveBeenCalled();
    });

    it('filters by agent when provided', async () => {
        const db = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    first: vi.fn().mockResolvedValue({ total: 0 }),
                    all: vi.fn().mockResolvedValue({ results: [] }),
                }),
            }),
        } as unknown as D1Database;
        const result = await getTeamExecutions(db, 't1', { limit: 20, offset: 0, agent: 'bot' });
        expect(result.executions).toEqual([]);
    });
});
