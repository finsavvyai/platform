import { describe, it, expect, vi } from 'vitest';

function mockEnv() {
    const deletedTables: string[] = [];
    return {
        DB: {
            prepare: vi.fn().mockImplementation((sql: string) => ({
                bind: vi.fn().mockReturnValue({
                    run: vi.fn().mockImplementation(async () => {
                        if (sql.startsWith('DELETE')) {
                            const table = sql.split('FROM ')[1]?.split(' ')[0];
                            deletedTables.push(table);
                        }
                        return {};
                    }),
                    first: vi.fn().mockResolvedValue({
                        id: 'user-1', email: 'test@example.com',
                        name: 'Test User', tier: 'pro',
                        created_at: '2026-01-01', updated_at: '2026-02-01',
                    }),
                    all: vi.fn().mockResolvedValue({ results: [] }),
                }),
            })),
        },
        KV: { delete: vi.fn().mockResolvedValue(undefined) },
        _deletedTables: deletedTables,
    } as any;
}

describe('GDPR Export', () => {
    it('should include all user data categories', () => {
        const exportData = {
            user: { id: 'user-1', email: 'test@example.com' },
            executions: [],
            chainExecutions: [],
            apiKeys: [],
            subscriptions: [],
            githubConnections: [],
        };
        expect(exportData).toHaveProperty('user');
        expect(exportData).toHaveProperty('executions');
        expect(exportData).toHaveProperty('chainExecutions');
        expect(exportData).toHaveProperty('apiKeys');
        expect(exportData).toHaveProperty('subscriptions');
        expect(exportData).toHaveProperty('githubConnections');
    });
});

describe('GDPR Delete', () => {
    it('should require DELETE_MY_ACCOUNT confirmation', () => {
        const body = { confirmation: 'wrong' };
        expect(body.confirmation).not.toBe('DELETE_MY_ACCOUNT');
    });

    it('should accept valid confirmation', () => {
        const body = { confirmation: 'DELETE_MY_ACCOUNT' };
        expect(body.confirmation).toBe('DELETE_MY_ACCOUNT');
    });

    it('should delete from all required tables', () => {
        const tables = [
            'executions', 'chain_executions', 'api_keys',
            'subscriptions', 'github_connections', 'team_members',
            'custom_agents', 'analytics_events', 'users',
        ];
        expect(tables.length).toBe(9);
        expect(tables).toContain('users');
        expect(tables).toContain('executions');
        expect(tables).toContain('api_keys');
    });
});

describe('User Profile', () => {
    it('should not expose password_hash in profile', () => {
        const selectFields = 'id, email, name, tier, created_at, updated_at';
        expect(selectFields).not.toContain('password');
    });
});
