/**
 * Team Membership Service — member role checks and management
 */

export interface TeamMember {
    user_id: string;
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'member';
    joined_at: string;
}

export interface TeamDetail {
    id: string;
    name: string;
    tier: string;
    created_at: string;
    members: TeamMember[];
}

/**
 * Get a user's role within a team, or null if not a member.
 */
export async function getMemberRole(
    db: D1Database,
    teamId: string,
    userId: string
): Promise<'owner' | 'admin' | 'member' | null> {
    const row = await db.prepare(
        'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).bind(teamId, userId).first<{ role: string }>();
    return (row?.role as 'owner' | 'admin' | 'member') ?? null;
}

/**
 * Get full team details including member list.
 */
export async function getTeamDetail(
    db: D1Database,
    teamId: string
): Promise<TeamDetail | null> {
    const team = await db.prepare(
        'SELECT id, name, tier, created_at FROM teams WHERE id = ?'
    ).bind(teamId).first<{ id: string; name: string; tier: string; created_at: string }>();

    if (!team) return null;

    const members = await db.prepare(`
        SELECT tm.user_id, u.email, u.name, tm.role, tm.joined_at
        FROM team_members tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.team_id = ?
        ORDER BY tm.joined_at ASC
    `).bind(teamId).all<TeamMember>();

    return { ...team, members: members.results || [] };
}

/**
 * Invite a user to a team by email.
 * Throws if user not found or already a member.
 */
export async function inviteMember(
    db: D1Database,
    teamId: string,
    email: string,
    role: 'admin' | 'member'
): Promise<TeamMember> {
    const user = await db.prepare(
        'SELECT id, email, name FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first<{ id: string; email: string; name: string }>();

    if (!user) throw new Error('User not found');

    const existing = await db.prepare(
        'SELECT user_id FROM team_members WHERE team_id = ? AND user_id = ?'
    ).bind(teamId, user.id).first();

    if (existing) throw new Error('User is already a team member');

    const now = new Date().toISOString();
    await db.prepare(
        'INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)'
    ).bind(teamId, user.id, role, now).run();

    return { user_id: user.id, email: user.email, name: user.name, role, joined_at: now };
}

/**
 * Remove a member from a team.
 * Throws if trying to remove the owner. Returns false if not a member.
 */
export async function removeMember(
    db: D1Database,
    teamId: string,
    userId: string
): Promise<boolean> {
    const member = await db.prepare(
        'SELECT role FROM team_members WHERE team_id = ? AND user_id = ?'
    ).bind(teamId, userId).first<{ role: string }>();

    if (!member) return false;
    if (member.role === 'owner') throw new Error('Cannot remove team owner');

    await db.prepare(
        'DELETE FROM team_members WHERE team_id = ? AND user_id = ?'
    ).bind(teamId, userId).run();

    return true;
}
