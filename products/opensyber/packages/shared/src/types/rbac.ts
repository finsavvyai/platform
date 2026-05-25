/**
 * RBAC and Organization Type Definitions
 */

import type { Role } from '../constants/roles.js';
import type { Permission } from '../constants/permissions.js';
import type { Plan } from './user.js';

export type { Role, Permission };

export type OrgMemberStatus = 'pending' | 'active' | 'removed';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  plan: Plan;
  maxInstances: number;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  orgId: string;
  userId: string;
  role: Role;
  invitedBy: string | null;
  invitedAt: string;
  acceptedAt: string | null;
  status: OrgMemberStatus;
}

export interface OrgInvitation {
  id: string;
  orgId: string;
  email: string;
  role: Role;
  invitedBy: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  status: InvitationStatus;
}

/** Organization enriched with the current user's context. */
export interface OrgWithMembership extends Organization {
  memberCount: number;
  currentUserRole: Role;
}

export interface CreateOrgInput {
  name: string;
  slug: string;
}

export interface UpdateOrgInput {
  name?: string;
}

export interface InviteMemberInput {
  email: string;
  role: Role;
}
