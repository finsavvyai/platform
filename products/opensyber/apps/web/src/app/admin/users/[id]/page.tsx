import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { SuspendUserButton } from '@/components/admin/SuspendUserButton';
import { ChangePlanSelect } from '@/components/admin/ChangePlanSelect';
import { ToggleAdminButton } from '@/components/admin/ToggleAdminButton';

export const metadata = { title: 'Admin — User Detail' };

interface UserDetail {
  user: {
    id: string;
    email: string;
    name: string | null;
    plan: string;
    isAdmin: boolean;
    isSuspended: boolean;
    createdAt: string;
  };
  instances: Array<{ id: string; name: string; status: string; createdAt: string }>;
  memberships: Array<{ orgId: string; orgName: string; role: string }>;
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = await getApiToken();
  if (!token) return <p className="text-text-secondary">Unauthorized</p>;

  let detail: UserDetail | null = null;
  try {
    detail = await apiClient<UserDetail>(`/api/admin/users/${id}`, { token });
  } catch {
    return <p className="text-text-secondary">Failed to load user.</p>;
  }

  const { user, instances, memberships } = detail;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">{user.name ?? user.email}</h1>
          <p className="mt-1 text-sm text-text-secondary">{user.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <ToggleAdminButton userId={user.id} isAdmin={user.isAdmin} />
          <SuspendUserButton userId={user.id} isSuspended={user.isSuspended} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded border border-border bg-panel/30 p-4">
          <p className="text-xs text-text-dim mb-1">Plan</p>
          <ChangePlanSelect userId={user.id} currentPlan={user.plan} />
        </div>
        <InfoCard label="Joined" value={formatDate(user.createdAt)} />
        <InfoCard label="Status" value={user.isSuspended ? 'Suspended' : 'Active'} />
      </div>

      <Section title={`Instances (${instances.length})`}>
        {instances.length === 0 ? (
          <p className="text-sm text-text-secondary">No instances.</p>
        ) : (
          <div className="rounded border border-border overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-secondary">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {instances.map((inst) => (
                  <tr key={inst.id} className="hover:bg-surface/30 transition">
                    <td className="px-6 py-3">{inst.name}</td>
                    <td className="px-6 py-3 capitalize">{inst.status}</td>
                    <td className="px-6 py-3 text-text-dim">{formatDate(inst.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </Section>

      <Section title={`Organizations (${memberships.length})`}>
        {memberships.length === 0 ? (
          <p className="text-sm text-text-secondary">No organization memberships.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {memberships.map((m) => (
              <div key={m.orgId} className="rounded-lg border border-border bg-panel/30 px-4 py-2">
                <p className="text-sm font-medium">{m.orgName}</p>
                <p className="text-xs text-text-secondary capitalize">{m.role}</p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-panel/30 p-4">
      <p className="text-xs text-text-dim">{label}</p>
      <p className="text-lg font-semibold capitalize">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}
