/**
 * Team Flow Integration Tests — create, invite, shared access, remove
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestContext, type TestContext, TEST_ADMIN } from '../setup';

let ctx: TestContext;
let teamId: string;
beforeAll(async () => { ctx = await createTestContext(); });
afterAll(async () => { await ctx.dispose(); });

describe('POST /teams — create team', () => {
  it('creates a new team for authenticated user', async () => {
    const res = await ctx.makeRequest('/teams', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ name: 'Integration Test Team' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.team).toBeDefined();
    expect(body.team.name).toBe('Integration Test Team');
    expect(body.team.id).toBeDefined();
    teamId = body.team.id;
  });

  it('rejects unauthenticated request', async () => {
    const res = await ctx.makeRequest('/teams', {
      auth: 'none',
      method: 'POST',
      body: JSON.stringify({ name: 'Should Fail' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /teams — list teams', () => {
  it('returns user teams', async () => {
    const res = await ctx.makeRequest('/teams', { auth: 'user' });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.teams).toBeDefined();
    expect(Array.isArray(body.teams)).toBe(true);
    expect(body.teams.length).toBeGreaterThan(0);
  });
});

describe('GET /teams/:id — team detail', () => {
  it('returns team detail for member', async () => {
    const res = await ctx.makeRequest(`/teams/${teamId}`, {
      auth: 'user',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.team).toBeDefined();
  });

  it('returns 404 for non-member', async () => {
    const res = await ctx.makeRequest(`/teams/${teamId}`, {
      auth: 'admin',
    });
    // Admin is not a member of this team
    expect(res.status).toBe(404);
  });
});

describe('POST /teams/:id/members — invite member', () => {
  it('invites an existing user to the team', async () => {
    const res = await ctx.makeRequest(`/teams/${teamId}/members`, {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        email: TEST_ADMIN.email,
        role: 'member',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.member).toBeDefined();
  });

  it('rejects inviting non-existent user', async () => {
    const res = await ctx.makeRequest(`/teams/${teamId}/members`, {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        email: 'nonexistent@lunaos.ai',
        role: 'member',
      }),
    });

    expect(res.status).toBe(400);
  });

  it('rejects duplicate member invite', async () => {
    const res = await ctx.makeRequest(`/teams/${teamId}/members`, {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({
        email: TEST_ADMIN.email,
        role: 'member',
      }),
    });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /teams/:id/members/:uid — remove member', () => {
  it('removes a member from the team', async () => {
    const res = await ctx.makeRequest(
      `/teams/${teamId}/members/${TEST_ADMIN.id}`,
      { auth: 'user', method: 'DELETE' },
    );

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  it('returns 404 for non-existent member', async () => {
    const res = await ctx.makeRequest(
      `/teams/${teamId}/members/nonexistent`,
      { auth: 'user', method: 'DELETE' },
    );

    expect(res.status).toBe(404);
  });
});

describe('Team shared agents', () => {
  it('GET /teams/:id/agents returns empty list initially', async () => {
    const res = await ctx.makeRequest(`/teams/${teamId}/agents`, {
      auth: 'user',
    });

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.agents).toBeDefined();
    expect(Array.isArray(body.agents)).toBe(true);
  });
});

describe('Full team lifecycle', () => {
  it('create -> invite -> shared access -> remove', async () => {
    // 1. Create team
    const createRes = await ctx.makeRequest('/teams', {
      auth: 'user',
      method: 'POST',
      body: JSON.stringify({ name: 'Lifecycle Team' }),
    });
    expect(createRes.status).toBe(201);
    const { team } = await createRes.json() as any;

    // 2. Invite admin
    const inviteRes = await ctx.makeRequest(
      `/teams/${team.id}/members`,
      {
        auth: 'user',
        method: 'POST',
        body: JSON.stringify({
          email: TEST_ADMIN.email,
          role: 'member',
        }),
      },
    );
    expect(inviteRes.status).toBe(201);

    // 3. Admin can now see the team
    const detailRes = await ctx.makeRequest(`/teams/${team.id}`, {
      auth: 'admin',
    });
    expect(detailRes.status).toBe(200);

    // 4. Remove admin
    const removeRes = await ctx.makeRequest(
      `/teams/${team.id}/members/${TEST_ADMIN.id}`,
      { auth: 'user', method: 'DELETE' },
    );
    expect(removeRes.status).toBe(200);

    // 5. Admin no longer has access
    const afterRes = await ctx.makeRequest(`/teams/${team.id}`, {
      auth: 'admin',
    });
    expect(afterRes.status).toBe(404);
  });
});
