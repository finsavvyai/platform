import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { Shield } from 'lucide-react';
import type { Role, SsoConfig } from '@opensyber/shared';
import { ROLE_HIERARCHY } from '@opensyber/shared';
import { SsoConfigForm } from '@/components/dashboard/team/SsoConfigForm';

interface OrgListItem {
  id: string;
  currentUserRole: Role;
}

export const metadata = { title: 'SSO Configuration' };

export default async function SsoPage() {
  const token = await getApiToken();
  if (!token) return <p className="text-text-secondary">Please sign in to manage SSO.</p>;

  let orgs: OrgListItem[] = [];
  try {
    const res = await apiClient<{ data: OrgListItem[] }>('/api/organizations', { token });
    orgs = res.data ?? [];
  } catch {
    return <p className="text-text-secondary">Failed to load organization.</p>;
  }

  if (orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
          <Shield className="h-6 w-6 text-text-secondary" />
        </div>
        <h3 className="text-base font-semibold mb-1">No organization</h3>
        <p className="text-sm text-text-secondary max-w-sm">
          Create an organization first to configure SSO.
        </p>
      </div>
    );
  }

  const activeOrg = orgs[0];
  const canManage = ROLE_HIERARCHY[activeOrg.currentUserRole] >= ROLE_HIERARCHY.admin;
  if (!canManage) {
    return <p className="text-text-secondary">You need admin access to manage SSO.</p>;
  }

  let config: SsoConfig | null = null;
  try {
    const data = await apiClient<{ data: SsoConfig }>(
      `/api/organizations/${activeOrg.id}/sso`, { token, orgId: activeOrg.id },
    );
    config = data.data;
  } catch {
    // No config yet — show empty form
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Single Sign-On</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure SAML or OIDC identity provider for your organization
        </p>
      </div>
      <SsoConfigForm orgId={activeOrg.id} existingConfig={config} />
    </div>
  );
}
