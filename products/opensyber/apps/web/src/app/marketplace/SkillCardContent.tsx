import Link from 'next/link';
import { Clock } from 'lucide-react';
import { SKILL_CATEGORY_LABELS } from '@opensyber/shared';
import type { SkillCategory, VerificationStatus } from '@opensyber/shared';
import { InstallSkillButton } from '@/components/marketplace/InstallSkillButton';
import { CATEGORY_STYLES, SkillIconRenderer } from './marketplace-utils';
import { getSkillStatus, isInstallable, STATUS_LABELS } from './skill-status';

interface MarketplaceSkill {
  id: string; slug: string; name: string; description: string | null;
  category: SkillCategory; currentVersion: string | null;
  verificationStatus: VerificationStatus; installCount: number;
  ratingAvg: number; ratingCount: number;
  isSigned?: boolean; hasSbom?: boolean;
}

interface Props {
  skill: MarketplaceSkill;
  instanceId: string | null;
  isInstalled: boolean;
}

export function SkillCardContent({ skill, instanceId, isInstalled }: Props) {
  const catStyle = CATEGORY_STYLES[skill.category];
  const status = getSkillStatus(skill.slug);
  const installable = isInstallable(status);
  const cardOpacity = installable ? '' : 'opacity-60';

  return (
    <div className={`rounded-xl border border-border bg-panel/30 p-5 ${cardOpacity}`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${catStyle?.bg ?? 'bg-surface'}`}>
          <SkillIconRenderer slug={skill.slug} category={skill.category} className={`h-5 w-5 ${catStyle?.color ?? 'text-text-secondary'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <Link href={`/marketplace/${skill.slug}`} className="font-semibold hover:text-signal transition">{skill.name}</Link>
              <span className="block text-xs text-text-dim">{SKILL_CATEGORY_LABELS[skill.category]}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap justify-end">
              {status === 'coming-soon' && (
                <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300 shrink-0 ml-2">
                  <Clock className="h-3 w-3" />Coming Soon
                </span>
              )}
              {status === 'ready' && (
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-300">Needs Config</span>
              )}
              {skill.verificationStatus === 'approved' && (
                <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">Verified</span>
              )}
              {skill.isSigned && <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-xs text-cyan-300">Signed</span>}
              {skill.hasSbom && <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-300">SBOM</span>}
            </div>
          </div>
        </div>
      </div>
      {skill.description && <p className="text-sm text-text-secondary mb-3 line-clamp-2">{skill.description}</p>}
      <div className="flex items-center justify-between text-xs text-text-dim">
        <span className="text-signal">{status === 'coming-soon' ? STATUS_LABELS[status] : 'Early Access'}</span>
        <div className="flex items-center gap-3">
          {!installable ? (
            <button disabled className="cursor-not-allowed rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-500">
              Coming Soon
            </button>
          ) : instanceId && skill.currentVersion ? (
            <InstallSkillButton instanceId={instanceId} skillId={skill.id} skillVersion={skill.currentVersion} alreadyInstalled={isInstalled} />
          ) : (
            <>{skill.currentVersion && <span className="font-mono">v{skill.currentVersion}</span>}</>
          )}
        </div>
      </div>
    </div>
  );
}
