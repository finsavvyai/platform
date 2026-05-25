import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { AssetsClient } from './AssetsClient';
import type { AssetRecord } from '../attack-paths/types';

export default async function AssetsPage() {
  let assets: AssetRecord[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const data = await apiClient<{ data: AssetRecord[] }>('/api/assets?limit=100', { token });
      assets = data.data ?? [];
    }
  } catch {
    // API not available
  }

  return <AssetsClient initialAssets={assets} />;
}
