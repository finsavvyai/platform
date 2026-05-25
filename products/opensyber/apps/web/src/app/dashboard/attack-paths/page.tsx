import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { AttackPathsClient } from './AttackPathsClient';

export default async function AttackPathsPage() {
  let assets: { id: string; name: string; assetType: string; sensitivity: string; isCrownJewel: boolean }[] = [];
  let crownJewels: typeof assets = [];

  try {
    const token = await getApiToken();
    if (token) {
      const [assetData, crownData] = await Promise.all([
        apiClient<{ data: typeof assets }>('/api/assets?assetType=agent_session&limit=20', { token }),
        apiClient<{ data: typeof crownJewels }>('/api/attack-paths/crown-jewels', { token }),
      ]);
      assets = assetData.data ?? [];
      crownJewels = crownData.data ?? [];
    }
  } catch {
    // API not available
  }

  return <AttackPathsClient sessions={assets} crownJewels={crownJewels} />;
}
