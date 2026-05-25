import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { Building2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Admin — Organizations' };

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  ownerName: string | null;
  memberCount: number;
  plan: string;
  createdAt: string;
}

export default async function AdminOrgsPage() {
  const token = await getApiToken();

  let orgs: OrgRow[] = [];
  try {
    if (token) {
      const data = await apiClient<{ data: OrgRow[] }>('/api/admin/organizations', { token });
      orgs = data.data;
    }
  } catch (err) { console.error('[AdminOrganizations] Failed to fetch organizations:', err instanceof Error ? err.message : err); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Organizations</h1>
        <p className="mt-1 text-sm text-text-secondary">All registered organizations</p>
      </div>

      {orgs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Building2 className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No organizations</h3>
          <p className="text-sm text-text-secondary">Organizations will appear here once created.</p>
        </div>
      ) : (
        <div className="rounded border border-border bg-panel/30 overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Slug</th>
                <th className="px-6 py-3 font-medium">Owner</th>
                <th className="px-6 py-3 font-medium">Members</th>
                <th className="px-6 py-3 font-medium">Plan</th>
                <th className="px-6 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {orgs.map((org) => (
                <tr key={org.id} className="hover:bg-surface/30 transition">
                  <td className="px-6 py-3 font-medium">{org.name}</td>
                  <td className="px-6 py-3 font-mono text-xs text-text-secondary">{org.slug}</td>
                  <td className="px-6 py-3 text-text-secondary">{org.ownerName ?? '—'}</td>
                  <td className="px-6 py-3">{org.memberCount}</td>
                  <td className="px-6 py-3 capitalize">{org.plan}</td>
                  <td className="px-6 py-3 text-text-dim">{formatDate(org.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
