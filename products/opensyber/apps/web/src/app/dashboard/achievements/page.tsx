import { Trophy, Shield } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { AchievementGrid } from '@/components/dashboard/AchievementGrid';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Security Achievements' };

interface AchievementData {
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
}

export default async function AchievementsPage() {
  let achievements: AchievementData[] = [];
  let instanceId: string | null = null;

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>(
        '/api/instances', { token },
      );
      const instance = instanceData.instances[0];
      if (instance) {
        instanceId = instance.id;
        const data = await apiClient<{ achievements: AchievementData[] }>(
          `/api/security/instances/${instance.id}/achievements`, { token },
        );
        achievements = data.achievements;
      }
    }
  } catch {
    // API not available
  }

  if (!instanceId) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-2">Achievements</h1>
        <p className="text-sm text-text-secondary mb-8">Security milestones for your AI agent</p>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Shield className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No instance found</h3>
          <p className="text-sm text-text-secondary max-w-sm">
            Deploy an instance to start earning security achievements.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-3">
        <Trophy className="h-6 w-6 text-amber-400" />
        <div>
          <h1 className="text-2xl font-bold">Achievements</h1>
          <p className="text-sm text-text-secondary mt-1">
            Earn security milestones and share them with the world
          </p>
        </div>
      </div>
      <AchievementGrid achievements={achievements} instanceId={instanceId} />
    </div>
  );
}
