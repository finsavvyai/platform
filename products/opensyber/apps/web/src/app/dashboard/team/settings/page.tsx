import { getApiToken } from '@/lib/auth-token';

import { apiClient } from '@/lib/api';
import type { Role } from '@opensyber/shared';
import { ROLE_HIERARCHY } from '@opensyber/shared';
import { OrgSettingsForm } from '@/components/dashboard/team/OrgSettingsForm';
import { DeleteOrgSection } from '@/components/dashboard/team/DeleteOrgSection';

interface OrgListItem {
  id: string;
  currentUserRole: Role;
}

interface OrgData {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  plan: string;
  maxInstances: number;
}

export default async function TeamSettingsPage() {
  const token = await getApiToken();
  if (!token) return <p className="text-text-secondary">Unauthorized</p>;

  let orgs: OrgListItem[] = [];
  try {
    const res = await apiClient<{ data: OrgListItem[] }>('/api/organizations', { token });
    orgs = res.data ?? [];
  } catch {
    return <p className="text-text-secondary">No organization found.</p>;
  }

  if (orgs.length === 0) {
    return <p className="text-text-secondary">No organization found.</p>;
  }

  const activeOrg = orgs[0];
  const currentUserRole = activeOrg.currentUserRole;
  const canEdit = ROLE_HIERARCHY[currentUserRole] >= ROLE_HIERARCHY.admin;
  const isOwner = currentUserRole === 'owner';

  let org: OrgData | null = null;
  try {
    const res = await apiClient<{ data: OrgData }>(`/api/organizations/${activeOrg.id}`, {
      token, orgId: activeOrg.id,
    });
    org = res.data;
  } catch {
    return <p className="text-text-secondary">Failed to load settings.</p>;
  }

  if (!org) return <p className="text-neutral-400">Organization not found.</p>;

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold">Team Settings</h1>

      <OrgSettingsForm
        orgId={org.id}
        name={org.name}
        slug={org.slug}
        canEdit={canEdit}
      />

      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-dim">
          Plan Details
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-dim">Plan</p>
            <p className="text-sm font-medium capitalize">{org.plan}</p>
          </div>
          <div>
            <p className="text-xs text-text-dim">Instance Limit</p>
            <p className="text-sm font-medium">{org.maxInstances}</p>
          </div>
        </div>
      </div>

      {isOwner && (
        <DeleteOrgSection orgId={org.id} orgName={org.name} />
      )}
    </div>
  );
}
