import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { MarketplaceClient } from './MarketplaceClient';
import type { BundleData } from '@/components/dashboard/BundleCard';

interface Skill {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  tier: string;
  installCount: number;
  ratingAvg: number;
  ratingCount: number;
  isFeatured: boolean;
  isCertified: boolean;
  isSigned?: boolean;
  hasSbom?: boolean;
}

interface Instance {
  id: string;
  name: string;
  status: string;
}

interface Recommendation {
  skillSlug: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  signal: string;
  skill: Skill | null;
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  let skills: Skill[] = [];
  let featured: Skill[] = [];
  let agents: Instance[] = [];
  let recommendations: Recommendation[] = [];
  let installedSkillIds: string[] = [];
  let bundles: BundleData[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const [allData, featData, instanceData, recsData, bundleData] = await Promise.all([
        apiClient<{ data: Skill[] }>('/api/marketplace?limit=50', { token }),
        apiClient<{ data: Skill[] }>('/api/marketplace/featured', { token }),
        apiClient<{ instances: Instance[] }>('/api/instances', { token }).catch(() => ({ instances: [] as Instance[] })),
        apiClient<{ data: Recommendation[] }>('/api/marketplace/recommendations', { token }).catch(() => ({ data: [] as Recommendation[] })),
        apiClient<{ data: BundleData[] }>('/api/bundles', { token }).catch(() => ({ data: [] as BundleData[] })),
      ]);
      skills = allData.data ?? [];
      featured = featData.data ?? [];
      agents = instanceData.instances ?? [];
      recommendations = recsData.data ?? [];
      bundles = bundleData.data ?? [];
      const firstInstance = agents[0];
      if (firstInstance) {
        const installData = await apiClient<{ skills: Array<{ installation: { skillId: string } }> }>(
          `/api/instances/${firstInstance.id}/skills`, { token },
        ).catch(() => ({ skills: [] }));
        installedSkillIds = installData.skills.map((s) => s.installation.skillId);
      }
    }
  } catch {
    // API not available
  }

  return (
    <MarketplaceClient
      skills={skills}
      featured={featured}
      agents={agents}
      recommendations={recommendations}
      installedSkillIds={installedSkillIds}
      bundles={bundles}
      initialTab={params.tab ?? 'skills'}
    />
  );
}
