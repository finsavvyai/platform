import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { redirect } from 'next/navigation';
import { SkillConfigWizard } from './SkillConfigWizard';

export const metadata = { title: 'Configure Skill' };

interface SkillDetail {
  id: string; slug: string; name: string; description: string | null;
  category: string; currentVersion: string; manifest: string;
}

interface Installation {
  id: string; skillId: string; version: string; isActive: boolean;
}

export default async function SkillConfigurePage({
  params,
}: {
  params: Promise<{ skillId: string }>;
}) {
  const { skillId } = await params;
  const token = await getApiToken();
  if (!token) redirect('/sign-in');

  let skill: SkillDetail | null = null;
  let installation: Installation | null = null;
  let instanceId: string | null = null;

  try {
    const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
    instanceId = instanceData.instances[0]?.id ?? null;

    if (instanceId) {
      const skillsData = await apiClient<{ skills: Array<{ installation: Installation; skill: SkillDetail }> }>(
        `/api/instances/${instanceId}/skills`, { token },
      );
      const match = skillsData.skills.find((s) => s.skill.id === skillId || s.skill.slug === skillId);
      if (match) {
        skill = match.skill;
        installation = match.installation;
      }
    }

    if (!skill) {
      const allSkills = await apiClient<{ skills: SkillDetail[] }>('/api/skills');
      skill = allSkills.skills.find((s) => s.id === skillId || s.slug === skillId) ?? null;
    }
  } catch (err) {
    console.error('[SkillConfig] Error:', err instanceof Error ? err.message : err);
  }

  if (!skill) redirect('/dashboard/skills');

  let manifest: { permissions?: { network?: string[]; filesystem?: string[]; env?: string[] } } = {};
  try { manifest = JSON.parse(skill.manifest); } catch { /* invalid manifest */ }

  return (
    <SkillConfigWizard
      skill={skill}
      manifest={manifest}
      installation={installation}
      instanceId={instanceId}
    />
  );
}
