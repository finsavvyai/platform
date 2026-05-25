import { describe, it, expect, vi } from 'vitest';
import { getMemberRole, getTeamDetail, inviteMember, removeMember } from './team-membership';

function mockDB(overrides: Record<string, unknown> = {}) {
    const defaults = { first: vi.fn().mockResolvedValue(null), all: vi.fn().mockResolvedValue({ results: [] }), run: vi.fn().mockResolvedValue({}) };
    const stmt = { bind: vi.fn().mockReturnValue({ ...defaults, ...overrides }) };
    return { prepare: vi.fn().mockReturnValue(stmt), batch: vi.fn().mockResolvedValue([]) } as unknown as D1Database;
}

describe('getMemberRole', () => {
    it('returns role for existing member', async () => {
        const db = mockDB({ first: vi.fn().mockResolvedValue({ role: 'admin' }) });
        expect(await getMemberRole(db, 'team-1', 'user-1')).toBe('admin');
    });

    it('returns null for non-member', async () => {
        const db = mockDB();
        expect(await getMemberRole(db, 'team-1', 'user-x')).toBeNull();
    });
});

describe('getTeamDetail', () => {
    it('returns team with members', async () => {
        const team = { id: 't1', name: 'Dev', tier: 'free', created_at: '2026-01-01' };
        const members = [{ user_id: 'u1', email: 'a@b.com', name: 'A', role: 'owner', joined_at: '2026-01-01' }];
        let callCount = 0;
        const db = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockImplementation(() => ({
                    first: vi.fn().mockImplementation(async () => callCount++ === 0 ? team : null),
                    all: vi.fn().mockResolvedValue({ results: members }),
                    run: vi.fn().mockResolvedValue({}),
                })),
            }),
        } as unknown as D1Database;
        const detail = await getTeamDetail(db, 't1');
        expect(detail).not.toBeNull();
        expect(detail?.name).toBe('Dev');
        expect(detail?.members).toHaveLength(1);
    });

    it('returns null for missing team', async () => {
        const db = mockDB();
        expect(await getTeamDetail(db, 'missing')).toBeNull();
    });
});

describe('inviteMember', () => {
    it('invites a user by email', async () => {
        const user = { id: 'u2', email: 'new@test.com', name: 'New' };
        let callCount = 0;
        const db = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    first: vi.fn().mockImplementation(async () => {
                        if (callCount++ === 0) return user;
                        return null;
                    }),
                    run: vi.fn().mockResolvedValue({}),
                }),
            }),
        } as unknown as D1Database;
        const member = await inviteMember(db, 't1', 'new@test.com', 'member');
        expect(member.user_id).toBe('u2');
        expect(member.role).toBe('member');
    });

    it('throws for unknown email', async () => {
        const db = mockDB();
        await expect(inviteMember(db, 't1', 'no@user.com', 'member')).rejects.toThrow('User not found');
    });

    it('throws for duplicate member', async () => {
        let callCount = 0;
        const db = {
            prepare: vi.fn().mockReturnValue({
                bind: vi.fn().mockReturnValue({
                    first: vi.fn().mockImplementation(async () => {
                        if (callCount++ === 0) return { id: 'u1', email: 'a@b.com', name: 'A' };
                        return { user_id: 'u1' };
                    }),
                    run: vi.fn().mockResolvedValue({}),
                }),
            }),
        } as unknown as D1Database;
        await expect(inviteMember(db, 't1', 'a@b.com', 'member')).rejects.toThrow('already a team member');
    });
});

describe('removeMember', () => {
    it('removes a member', async () => {
        const db = mockDB({ first: vi.fn().mockResolvedValue({ role: 'member' }) });
        expect(await removeMember(db, 't1', 'u2')).toBe(true);
    });

    it('throws when removing owner', async () => {
        const db = mockDB({ first: vi.fn().mockResolvedValue({ role: 'owner' }) });
        await expect(removeMember(db, 't1', 'u1')).rejects.toThrow('Cannot remove team owner');
    });

    it('returns false for non-member', async () => {
        const db = mockDB();
        expect(await removeMember(db, 't1', 'ux')).toBe(false);
    });
});
