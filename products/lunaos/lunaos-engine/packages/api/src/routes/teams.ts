/**
 * Team Routes — Manage teams, members, shared agents, and executions
 */

import { Hono } from 'hono';
import type { Env } from '../worker';
import { requireAuth } from '../middleware/auth';
import { validateJson, validateQuery } from '../middleware/validation';
import { createTeamSchema, inviteMemberSchema, shareAgentSchema, teamExecutionsQuerySchema } from '../schemas/team-schemas';
import {
    createTeam, getUserTeams, getTeamAgents, getMemberRole,
    getTeamDetail, inviteMember, removeMember,
    shareAgentWithTeam, unshareAgentFromTeam, getTeamExecutions,
} from '../services/team-service';

export const teamRoutes = new Hono<{ Bindings: Env }>();

// ─── POST /teams — Create a new team ────────────────────────────────────────

teamRoutes.post('/', requireAuth, validateJson(createTeamSchema), async (c) => {
    const { name } = c.req.valid('json');
    const userId = c.get('userId');
    try {
        const team = await createTeam(c.env.DB, userId, name);
        return c.json({ team }, 201);
    } catch {
        return c.json({ error: 'Failed to create team' }, 500);
    }
});

// ─── GET /teams — List user's teams ──────────────────────────────────────────

teamRoutes.get('/', requireAuth, async (c) => {
    const userId = c.get('userId');
    try {
        const teams = await getUserTeams(c.env.DB, userId);
        return c.json({ teams });
    } catch {
        return c.json({ error: 'Failed to fetch teams' }, 500);
    }
});

// ─── GET /teams/:id — Team details + members ────────────────────────────────

teamRoutes.get('/:id', requireAuth, async (c) => {
    const teamId = c.req.param('id');
    const role = await getMemberRole(c.env.DB, teamId, c.get('userId'));
    if (!role) return c.json({ error: 'Not found' }, 404);

    const detail = await getTeamDetail(c.env.DB, teamId);
    if (!detail) return c.json({ error: 'Not found' }, 404);
    return c.json({ team: detail });
});

// ─── POST /teams/:id/members — Invite member ────────────────────────────────

teamRoutes.post('/:id/members', requireAuth, validateJson(inviteMemberSchema), async (c) => {
    const teamId = c.req.param('id');
    const role = await getMemberRole(c.env.DB, teamId, c.get('userId'));
    if (!role) return c.json({ error: 'Not found' }, 404);
    if (!['owner', 'admin'].includes(role)) return c.json({ error: 'Forbidden' }, 403);

    const { email, role: memberRole } = c.req.valid('json');
    try {
        const member = await inviteMember(c.env.DB, teamId, email, memberRole);
        return c.json({ member }, 201);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to invite member';
        const status = message === 'User not found' || message === 'User is already a team member' ? 400 : 500;
        return c.json({ error: message }, status);
    }
});

// ─── DELETE /teams/:id/members/:uid — Remove member ──────────────────────────

teamRoutes.delete('/:id/members/:uid', requireAuth, async (c) => {
    const teamId = c.req.param('id');
    const role = await getMemberRole(c.env.DB, teamId, c.get('userId'));
    if (!role) return c.json({ error: 'Not found' }, 404);
    if (!['owner', 'admin'].includes(role)) return c.json({ error: 'Forbidden' }, 403);

    try {
        const removed = await removeMember(c.env.DB, teamId, c.req.param('uid'));
        if (!removed) return c.json({ error: 'Member not found' }, 404);
        return c.json({ success: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove member';
        if (message === 'Cannot remove team owner') return c.json({ error: message }, 403);
        return c.json({ error: message }, 500);
    }
});

// ─── POST /teams/:id/agents/share — Share agent with team ───────────────────

teamRoutes.post('/:id/agents/share', requireAuth, validateJson(shareAgentSchema), async (c) => {
    const teamId = c.req.param('id');
    const role = await getMemberRole(c.env.DB, teamId, c.get('userId'));
    if (!role) return c.json({ error: 'Not found' }, 404);
    if (!['owner', 'admin'].includes(role)) return c.json({ error: 'Forbidden' }, 403);

    const { agentId } = c.req.valid('json');
    try {
        await shareAgentWithTeam(c.env.DB, teamId, agentId, c.get('userId'));
        return c.json({ success: true }, 201);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to share agent';
        const status = message === 'Agent not found' || message === 'Agent already shared with this team' ? 400 : 500;
        return c.json({ error: message }, status);
    }
});

// ─── DELETE /teams/:id/agents/:aid/share — Unshare agent ────────────────────

teamRoutes.delete('/:id/agents/:aid/share', requireAuth, async (c) => {
    const teamId = c.req.param('id');
    const role = await getMemberRole(c.env.DB, teamId, c.get('userId'));
    if (!role) return c.json({ error: 'Not found' }, 404);
    if (!['owner', 'admin'].includes(role)) return c.json({ error: 'Forbidden' }, 403);

    const removed = await unshareAgentFromTeam(c.env.DB, teamId, c.req.param('aid'));
    if (!removed) return c.json({ error: 'Agent not shared with this team' }, 404);
    return c.json({ success: true });
});

// ─── GET /teams/:id/agents — List shared agents ─────────────────────────────

teamRoutes.get('/:id/agents', requireAuth, async (c) => {
    const teamId = c.req.param('id');
    const role = await getMemberRole(c.env.DB, teamId, c.get('userId'));
    if (!role) return c.json({ error: 'Not found' }, 404);

    const agents = await getTeamAgents(c.env.DB, teamId);
    return c.json({ agents });
});

// ─── GET /teams/:id/executions — Team execution history ─────────────────────

teamRoutes.get('/:id/executions', requireAuth, validateQuery(teamExecutionsQuerySchema), async (c) => {
    const teamId = c.req.param('id');
    const role = await getMemberRole(c.env.DB, teamId, c.get('userId'));
    if (!role) return c.json({ error: 'Not found' }, 404);

    const { limit, offset, agent } = c.req.valid('query');
    const result = await getTeamExecutions(c.env.DB, teamId, { limit, offset, agent });
    return c.json(result);
});
