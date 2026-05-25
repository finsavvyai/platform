import Link from 'next/link';
import { CheckCircle, AlertTriangle, XCircle, Store, Settings } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { SKILL_CATEGORY_LABELS } from '@opensyber/shared';
import type { SkillCategory, VerificationStatus } from '@opensyber/shared';
import { UninstallSkillButton } from '@/components/dashboard/UninstallSkillButton';
import { SkillToggleButton } from '@/components/dashboard/SkillToggleButton';
import { SkillsEmptyState } from '@/components/dashboard/SkillsEmptyState';
import { SkillSignatureBadge } from '@/components/dashboard/skills/SkillSignatureBadge';

export const metadata = {
  title: 'Installed Skills',
};

interface SkillInstallation {
  installation: {
    id: string;
    instanceId: string;
    skillId: string;
    version: string;
    installedAt: string;
    isActive: boolean;
  };
  skill: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    category: SkillCategory;
    verificationStatus: VerificationStatus;
    currentVersion: string | null;
  };
}

const verificationIcons: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  approved: { icon: CheckCircle, color: 'text-green-400', label: 'Verified' },
  pending: { icon: AlertTriangle, color: 'text-yellow-400', label: 'Pending' },
  scanning: { icon: AlertTriangle, color: 'text-yellow-400', label: 'Scanning' },
  reviewing: { icon: AlertTriangle, color: 'text-yellow-400', label: 'Reviewing' },
  rejected: { icon: XCircle, color: 'text-red-400', label: 'Rejected' },
  revoked: { icon: XCircle, color: 'text-red-400', label: 'Revoked' },
};

export default async function SkillsPage() {
  let installations: SkillInstallation[] = [];
  let instanceId: string | null = null;

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{
        instances: Array<{ id: string }>;
      }>('/api/instances', { token });
      const instance = instanceData.instances[0];
      if (instance) {
        instanceId = instance.id;
        const data = await apiClient<{ skills: SkillInstallation[] }>(
          `/api/instances/${instance.id}/skills`,
          { token },
        );
        installations = data.skills;
      }
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Installed Skills</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage skills installed on your instance
          </p>
        </div>
        <Link
          href="/dashboard/marketplace"
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition"
        >
          <Store className="h-4 w-4" />
          Browse Marketplace
        </Link>
      </div>

      {installations.length === 0 ? (
        <SkillsEmptyState />
      ) : (
        <div className="rounded border border-border bg-panel/30 overflow-hidden">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-6 py-3 font-medium">Skill</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Active</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium">Version</th>
                <th className="px-6 py-3 font-medium">Installed</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {installations.map(({ installation, skill }) => {
                const verification = verificationIcons[skill.verificationStatus] ?? verificationIcons.pending;
                const VerifIcon = verification.icon;
                const isActive = installation.isActive;
                return (
                  <tr key={installation.id} className="hover:bg-surface/30 transition">
                    <td className="px-6 py-4">
                      <Link
                        href={`/marketplace/${skill.slug}`}
                        className="font-medium hover:text-signal transition"
                      >
                        {skill.name}
                      </Link>
                      {skill.description && (
                        <div className="text-xs text-text-dim mt-0.5 max-w-xs truncate">
                          {skill.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-1.5 text-xs">
                        <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-neutral-500'}`} />
                        <span className={isActive ? 'text-green-400' : 'text-text-secondary'}>
                          {isActive ? 'Running' : 'Stopped'}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {instanceId && (
                        <SkillToggleButton
                          instanceId={instanceId}
                          skillId={skill.id}
                          initialActive={isActive}
                        />
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-secondary">
                      {SKILL_CATEGORY_LABELS[skill.category] ?? skill.category}
                    </td>
                    <td className="px-6 py-4">
                      <SkillSignatureBadge
                        version={installation.version}
                        verified={skill.verificationStatus === 'approved'}
                        hasSbom={skill.verificationStatus === 'approved'}
                        reviewedAt={null}
                      />
                    </td>
                    <td className="px-6 py-4 text-text-dim whitespace-nowrap">
                      {formatDate(installation.installedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/skills/${skill.id}/configure`}
                          className="flex items-center gap-1 rounded-lg border border-wire px-2.5 py-1 text-xs text-text-secondary hover:bg-surface hover:text-signal transition"
                        >
                          <Settings className="h-3 w-3" />
                          Configure
                        </Link>
                        {instanceId && (
                          <UninstallSkillButton
                            instanceId={instanceId}
                            skillId={skill.id}
                            skillName={skill.name}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
