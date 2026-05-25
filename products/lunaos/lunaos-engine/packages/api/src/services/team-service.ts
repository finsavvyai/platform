/**
 * Team Service — Create teams, share agents, query executions
 */

export { getMemberRole, getTeamDetail, inviteMember, removeMember } from './team-membership';
export type { TeamMember, TeamDetail } from './team-membership';

export interface Team {
    id: string;
    name: string;
    tier: 'free' | 'pro' | 'team';
    role: 'owner' | 'admin' | 'member';
    joined_at: string;
}

export interface SharedAgent {
    agent_id: string;
    name: string;
    slug: string;
    description: string | null;
    shared_by: string;
    shared_at: string;
}

export interface TeamExecution {
    id: string;
    user_id: string;
    agent: string;
    provider: string;
    model: string;
    duration_ms: number;
    status: string;
    created_at: string;
}

/**
 * Create a new team and add the user as 'owner'.
 */
export async function createTeam(
    db: D1Database,
    userId: string,
    name: string
): Promise<Team> {
    const teamId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.batch([
        db.prepare(
            `INSERT INTO teams (id, name, tier, created_at, updated_at) VALUES (?, ?, 'free', ?, ?)`
        ).bind(teamId, name, now, now),
        db.prepare(
            `INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`
        ).bind(teamId, userId, now),
    ]);

    return { id: teamId, name, tier: 'free', role: 'owner', joined_at: now };
}

/**
 * Get all teams a user belongs to.
 */
export async function getUserTeams(
    db: D1Database,
    userId: string
): Promise<Team[]> {
    const results = await db.prepare(`
        SELECT t.id, t.name, t.tier, tm.role, tm.joined_at
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = ?
        ORDER BY tm.joined_at DESC
    `).bind(userId).all<Team>();

    return results.results || [];
}

/**
 * Share a custom agent with a team.
 * Throws if agent does not exist.
 */
export async function shareAgentWithTeam(
    db: D1Database,
    teamId: string,
    agentId: string,
    sharedBy: string
): Promise<void> {
    const agent = await db.prepare(
        'SELECT id FROM custom_agents WHERE id = ?'
    ).bind(agentId).first();

    if (!agent) throw new Error('Agent not found');

    const existing = await db.prepare(
        'SELECT agent_id FROM team_shared_agents WHERE team_id = ? AND agent_id = ?'
    ).bind(teamId, agentId).first();

    if (existing) throw new Error('Agent already shared with this team');

    await db.prepare(
        'INSERT INTO team_shared_agents (team_id, agent_id, shared_by, shared_at) VALUES (?, ?, ?, ?)'
    ).bind(teamId, agentId, sharedBy, new Date().toISOString()).run();
}

/**
 * Unshare a custom agent from a team. Returns false if not shared.
 */
export async function unshareAgentFromTeam(
    db: D1Database,
    teamId: string,
    agentId: string
): Promise<boolean> {
    const existing = await db.prepare(
        'SELECT agent_id FROM team_shared_agents WHERE team_id = ? AND agent_id = ?'
    ).bind(teamId, agentId).first();

    if (!existing) return false;

    await db.prepare(
        'DELETE FROM team_shared_agents WHERE team_id = ? AND agent_id = ?'
    ).bind(teamId, agentId).run();

    return true;
}

/**
 * Get agents shared with a team (real DB query).
 */
export async function getTeamAgents(
    db: D1Database,
    teamId: string
): Promise<SharedAgent[]> {
    const results = await db.prepare(`
        SELECT tsa.agent_id, ca.name, ca.slug, ca.description,
               tsa.shared_by, tsa.shared_at
        FROM team_shared_agents tsa
        JOIN custom_agents ca ON tsa.agent_id = ca.id
        WHERE tsa.team_id = ?
        ORDER BY tsa.shared_at DESC
    `).bind(teamId).all<SharedAgent>();

    return results.results || [];
}

interface ExecutionQueryOpts {
    limit: number;
    offset: number;
    agent?: string;
}

/**
 * Get execution history for all team members.
 */
export async function getTeamExecutions(
    db: D1Database,
    teamId: string,
    opts: ExecutionQueryOpts
): Promise<{ executions: TeamExecution[]; total: number }> {
    const agentFilter = opts.agent ? 'AND e.agent = ?' : '';
    const binds: (string | number)[] = [teamId];
    if (opts.agent) binds.push(opts.agent);

    const countResult = await db.prepare(`
        SELECT COUNT(*) as total FROM executions e
        WHERE e.user_id IN (SELECT user_id FROM team_members WHERE team_id = ?)
        ${agentFilter}
    `).bind(...binds).first<{ total: number }>();

    const queryBinds = [...binds, opts.limit, opts.offset];
    const results = await db.prepare(`
        SELECT e.id, e.user_id, e.agent, e.provider, e.model,
               e.duration_ms, e.status, e.created_at
        FROM executions e
        WHERE e.user_id IN (SELECT user_id FROM team_members WHERE team_id = ?)
        ${agentFilter}
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
    `).bind(...queryBinds).all<TeamExecution>();

    return {
        executions: results.results || [],
        total: countResult?.total ?? 0,
    };
}
