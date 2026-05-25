import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import type { Role } from '@opensyber/shared';
import { RoleBuilder } from './RoleBuilder';

interface CustomRole {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  permissions: string[];
  isDefault: boolean;
  createdAt: string;
}

const BUILT_IN_ROLES: { role: Role; label: string; description: string }[] = [
  { role: 'owner', label: 'Owner', description: 'Full access. Cannot be assigned via invite.' },
  { role: 'admin', label: 'Admin', description: 'All permissions except org deletion and billing management.' },
  { role: 'security', label: 'Security', description: 'Policies, incidents, alerts, compliance, and audit.' },
  { role: 'developer', label: 'Developer', description: 'Instances, skills, vault read/write, marketplace install.' },
  { role: 'viewer', label: 'Viewer', description: 'Read-only access to all dashboards.' },
];

export default async function RolesPage() {
  const token = await getApiToken();
  let customRoles: CustomRole[] = [];
  let orgId: string | null = null;

  try {
    // orgId comes from cookies/headers in practice; for now use first org
    const orgRes = await apiClient<{ data: { id: string }[] }>('/api/organizations', {
      headers: { Authorization: `Bearer ${token}` },
    });
    orgId = orgRes.data?.[0]?.id ?? null;

    if (orgId) {
      const res = await apiClient<{ data: CustomRole[] }>(
        `/api/organizations/${orgId}/roles`,
        { headers: { Authorization: `Bearer ${token}`, 'X-Org-Id': orgId } },
      );
      customRoles = res.data ?? [];
    }
  } catch {
    // Graceful fallback — show built-in roles only
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Roles &amp; Permissions</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage built-in and custom roles for your organization.
        </p>
      </div>

      {/* Built-in Roles */}
      <section>
        <h2 className="text-lg font-semibold text-white mb-4">Built-in Roles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {BUILT_IN_ROLES.map((r) => (
            <div
              key={r.role}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{r.label}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
                  Built-in
                </span>
              </div>
              <p className="text-sm text-gray-400">{r.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Custom Roles */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Custom Roles</h2>
        </div>

        {customRoles.length > 0 ? (
          <div className="space-y-3">
            {customRoles.map((role) => (
              <div
                key={role.id}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-white">{role.name}</span>
                    {role.isDefault && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-400">
                        Default
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {role.permissions.length} permissions
                  </span>
                </div>
                {role.description && (
                  <p className="text-sm text-gray-400 mt-1">{role.description}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No custom roles yet. Create one to assign specific permissions.
          </p>
        )}
      </section>

      {/* Role Builder */}
      {orgId && <RoleBuilder orgId={orgId} />}
    </div>
  );
}
