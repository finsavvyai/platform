/**
 * Team Management — shared types and role definitions
 */

export interface Team {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  settings: TeamSettings;
  createdAt: string;
  updatedAt: string;
}

export interface TeamSettings {
  maxMembers: number;
  defaultRole: TeamRole;
  sharingEnabled: boolean;
  activityRetention: number;
  requireApproval: boolean;
}

export interface TeamMember {
  userId: string;
  teamId: string;
  role: TeamRole;
  joinedAt: string;
  invitedBy: string;
  status: MemberStatus;
  lastActive: string;
  user?: { id: string; name: string; email: string; avatar?: string };
}

export type TeamRole = 'owner' | 'admin' | 'developer' | 'viewer' | 'guest';
export type MemberStatus = 'active' | 'pending' | 'inactive' | 'suspended';

export interface TeamInvitation {
  id: string;
  teamId: string;
  invitedBy: string;
  email: string;
  role: TeamRole;
  token: string;
  expiresAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  createdAt: string;
}

export interface TeamActivity {
  id: string;
  teamId: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
  user?: { id: string; name: string; avatar?: string };
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  settings?: Partial<TeamSettings>;
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  settings?: Partial<TeamSettings>;
}

export interface InviteMembersRequest {
  teamId: string;
  emails: string[];
  role: TeamRole;
}

export interface UpdateMemberRoleRequest {
  teamId: string;
  userId: string;
  role: TeamRole;
}

export interface UseTeamManagementReturn {
  createTeam: (request: CreateTeamRequest) => Promise<Team>;
  updateTeam: (teamId: string, request: UpdateTeamRequest) => Promise<Team>;
  deleteTeam: (teamId: string) => Promise<void>;
  getTeam: (teamId: string) => Promise<Team>;
  inviteMembers: (request: InviteMembersRequest) => Promise<TeamInvitation[]>;
  acceptInvitation: (token: string) => Promise<Team>;
  updateMemberRole: (request: UpdateMemberRoleRequest) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  teams: Team[];
  currentTeam: Team | null;
  members: TeamMember[];
  activity: TeamActivity[];
  invitations: TeamInvitation[];
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  error: Error | null;
}

export const TEAM_ROLES = {
  owner: { name: 'Owner', description: 'Full control over the team', permissions: ['all'], color: 'red' },
  admin: { name: 'Admin', description: 'Manage team members and settings', permissions: ['invite', 'remove_members', 'update_settings', 'view', 'create'], color: 'orange' },
  developer: { name: 'Developer', description: 'Create and edit queries', permissions: ['view', 'create', 'edit'], color: 'blue' },
  viewer: { name: 'Viewer', description: 'View-only access', permissions: ['view'], color: 'gray' },
  guest: { name: 'Guest', description: 'Limited access with approval', permissions: ['view_limited'], color: 'purple' },
} as const;
