import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { ResidencyForm } from '@/components/dashboard/team/ResidencyForm';
import { Globe } from 'lucide-react';

interface ResidencyData {
  region: string;
  storageRegion: string;
  computeRegion: string;
  enforceStrict: boolean;
}

export default async function ResidencyPage() {
  const token = await getApiToken();

  let orgs: Array<{ id: string; name: string }> = [];
  let residency: ResidencyData | null = null;

  try {
    if (token) {
      const orgRes = await apiClient<{ data: Array<{ id: string; name: string }> }>(
        '/api/organizations', { token },
      );
      orgs = orgRes.data ?? [];

      if (orgs.length > 0) {
        const resRes = await apiClient<{ data: ResidencyData | null }>(
          `/api/organizations/${orgs[0].id}/residency`, { token, orgId: orgs[0].id },
        );
        residency = resRes.data;
      }
    }
  } catch {
    // API not available
  }

  if (orgs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
        <Globe className="h-12 w-12 mb-4 text-text-dim" />
        <p className="text-lg font-medium">No organization found</p>
        <p className="text-sm text-text-dim mt-1">Create an organization to configure data residency</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Data Residency</h1>
      <p className="text-sm text-text-secondary">
        Control where your data is stored and where agent compute runs.
        Once set, existing instances cannot be moved.
      </p>
      <ResidencyForm orgId={orgs[0].id} current={residency} />
    </div>
  );
}
