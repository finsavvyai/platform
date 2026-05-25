import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { Package } from 'lucide-react';
import { SkillModerationCard } from '@/components/admin/SkillModerationCard';

export const metadata = { title: 'Admin — Skills Moderation' };

interface PendingSkill {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export default async function AdminSkillsPage() {
  const token = await getApiToken();

  let skills: PendingSkill[] = [];
  try {
    if (token) {
      const data = await apiClient<{ data: PendingSkill[] }>('/api/admin/skills', { token });
      skills = data.data;
    }
  } catch (err) { console.error('[AdminSkills] Failed to fetch pending skills:', err instanceof Error ? err.message : err); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Skills Moderation</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Review and approve skill submissions ({skills.length} pending)
        </p>
      </div>

      {skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Package className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No pending skills</h3>
          <p className="text-sm text-text-secondary">All skill submissions have been reviewed.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {skills.map((skill) => (
            <SkillModerationCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}
