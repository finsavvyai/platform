/** RBAC — Role-based access control for project membership. */

import type { Env } from '../types';
import { verifyToken, extractToken, type JwtPayload } from './jwt';

export type ProjectRole = 'owner' | 'admin' | 'member';

interface MemberRow {
  user_id: string;
  role: string;
  email: string;
  name: string;
}

const ROLE_HIERARCHY: Record<ProjectRole, number> = { owner: 3, admin: 2, member: 1 };

/** Check if a user has at least the required role on a project. */
export async function checkProjectAccess(
  env: Env, userId: string, projectId: string, requiredRole: ProjectRole = 'member',
): Promise<boolean> {
  const member = await env.DB.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
  ).bind(projectId, userId).first<{ role: string }>();

  if (!member) return false;
  const userLevel = ROLE_HIERARCHY[member.role as ProjectRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

/** Get the authenticated user from a request. Returns null if not authenticated. */
export async function getAuthUser(request: Request, env: Env): Promise<JwtPayload | null> {
  const secret = env.AUTH_SECRET;
  if (!secret) return null;
  const token = extractToken(request);
  if (!token) return null;
  return verifyToken(token, secret);
}

/** List all members of a project. */
export async function listProjectMembers(env: Env, projectId: string): Promise<MemberRow[]> {
  const rows = await env.DB.prepare(`
    SELECT pm.user_id, pm.role, u.email, u.name
    FROM project_members pm JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ? ORDER BY pm.role DESC, u.email ASC
  `).bind(projectId).all<MemberRow>();
  return rows.results ?? [];
}

/** Add a member to a project. Only owners/admins can add members. */
export async function addProjectMember(
  env: Env, projectId: string, userId: string, role: ProjectRole = 'member',
): Promise<void> {
  await env.DB.prepare(
    'INSERT OR IGNORE INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)',
  ).bind(crypto.randomUUID(), projectId, userId, role).run();
}

/** Remove a member from a project. Cannot remove the last owner. */
export async function removeProjectMember(
  env: Env, projectId: string, userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const member = await env.DB.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
  ).bind(projectId, userId).first<{ role: string }>();

  if (!member) return { ok: false, error: 'Member not found' };

  if (member.role === 'owner') {
    const ownerCount = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM project_members WHERE project_id = ? AND role = 'owner'",
    ).bind(projectId).first<{ cnt: number }>();
    if (ownerCount && ownerCount.cnt <= 1) return { ok: false, error: 'Cannot remove the last owner' };
  }

  await env.DB.prepare(
    'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
  ).bind(projectId, userId).run();
  return { ok: true };
}

/** Update a member's role. Only owners can change roles. */
export async function updateMemberRole(
  env: Env, projectId: string, userId: string, newRole: ProjectRole,
): Promise<void> {
  await env.DB.prepare(
    'UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?',
  ).bind(newRole, projectId, userId).run();
}
