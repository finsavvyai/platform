import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import type { Role } from '@opensyber/shared';
import { ROLE_HIERARCHY } from '@opensyber/shared';
import { CreateOrgButton } from '@/components/dashboard/team/CreateOrgButton';
import { InviteMemberButton } from '@/components/dashboard/team/InviteMemberButton';
import { MemberTable } from '@/components/dashboard/team/MemberTable';
import { PendingInvitations } from '@/components/dashboard/team/PendingInvitations';

interface OrgMember {
  userId: string;
  name: string | null;
  email: string;
  role: Role;
  acceptedAt: string | null;
}

interface OrgData {
  id: string;
  name: string;
  ownerId: string;
  members: OrgMember[];
  memberCount: number;
}

interface OrgListItem {
  id: string;
  currentUserRole: Role;
}

export default async function TeamPage() {
  const token = await getApiToken();
  if (!token) return <CreateOrgButton />;

  let orgs: OrgListItem[] = [];
  try {
    const res = await apiClient<{ data: OrgListItem[] }>('/api/organizations', { token });
    orgs = res.data ?? [];
  } catch {
    return <CreateOrgButton />;
  }

  if (orgs.length === 0) return <CreateOrgButton />;

  const activeOrg = orgs[0];
  let orgData: OrgData | null = null;
  try {
    const res = await apiClient<{ data: OrgData }>(`/api/organizations/${activeOrg.id}`, {
      token, orgId: activeOrg.id,
    });
    orgData = res.data;
  } catch {
    return <p className="text-text-secondary">Failed to load team details.</p>;
  }

  if (!orgData) return <p className="text-text-secondary">Organization not found.</p>;

  const currentUserRole = activeOrg.currentUserRole;
  const canManage = ROLE_HIERARCHY[currentUserRole] >= ROLE_HIERARCHY.admin;
  const activeMembers = orgData.members.filter((m) => m.acceptedAt);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Team</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {orgData.name} &mdash; {activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <InviteMemberButton orgId={orgData.id} currentUserRole={currentUserRole} />
        )}
      </div>

      <MemberTable
        orgId={orgData.id}
        ownerId={orgData.ownerId}
        members={activeMembers}
        currentUserRole={currentUserRole}
        canManage={canManage}
      />

      {canManage && (
        <PendingInvitations
          orgId={orgData.id}
          invitations={[]}
          canManage={canManage}
        />
      )}
    </div>
  );
}
