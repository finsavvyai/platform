/**
 * Team Management — utility functions
 */

import type { TeamRole, TeamMember, MemberStatus } from './teamTypes';
import { TEAM_ROLES } from './teamTypes';

export function getRoleInfo(role: TeamRole) {
  return TEAM_ROLES[role];
}

export function canPerformAction(userRole: TeamRole, action: string): boolean {
  const roleInfo = TEAM_ROLES[userRole];
  const permissions = roleInfo.permissions as readonly string[];
  return permissions.includes('all') || permissions.includes(action);
}

export function getRoleColor(role: TeamRole): string {
  return TEAM_ROLES[role].color;
}

export function formatMemberCount(count: number, max?: number): string {
  if (max) return `${count} / ${max}`;
  return `${count} member${count !== 1 ? 's' : ''}`;
}

export function isTeamAtCapacity(memberCount: number, maxMembers: number): boolean {
  return memberCount >= maxMembers;
}

export function getAvailableRoles(userRole: TeamRole): TeamRole[] {
  if (userRole === 'owner') return ['admin', 'developer', 'viewer', 'guest'];
  if (userRole === 'admin') return ['developer', 'viewer', 'guest'];
  return [];
}

export function sortMembers(members: TeamMember[]): TeamMember[] {
  const roleOrder = ['owner', 'admin', 'developer', 'viewer', 'guest'];
  return [...members].sort((a, b) => {
    const roleDiff = roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);
    if (roleDiff !== 0) return roleDiff;
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });
}

export function filterMembersByStatus(members: TeamMember[], status: MemberStatus): TeamMember[] {
  return members.filter((member) => member.status === status);
}

export function getMemberInitials(name?: string, email?: string): string {
  if (name) {
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '??';
}
