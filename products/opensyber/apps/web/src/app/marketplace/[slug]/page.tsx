import { getApiToken } from '@/lib/auth-token';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, ExternalLink, Shield } from 'lucide-react';

import { apiClient } from '@/lib/api';
import { SKILL_CATEGORY_LABELS } from '@opensyber/shared';
import type { SkillCategory, VerificationStatus } from '@opensyber/shared';
import { InstallSkillButton } from '@/components/marketplace/InstallSkillButton';
import { RateSkillButton } from '@/components/marketplace/RateSkillButton';
import { SiteHeader } from '@/components/SiteHeader';
import { CATEGORY_STYLES, getSkillIcon } from '../marketplace-utils';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${slug} — Skill Marketplace` };
}

interface SkillDetail {
  id: string; slug: string; name: string; description: string | null;
  category: SkillCategory; githubUrl: string | null; currentVersion: string | null;
  verificationStatus: VerificationStatus; installCount: number;
  ratingAvg: number; ratingCount: number; createdAt: string;
}

export default async function SkillDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let skill: SkillDetail | null = null;
  let instanceId: string | null = null;
  let isSignedIn = false;

  try {
    const data = await apiClient<{ skill: SkillDetail }>(`/api/skills/${slug}`);
    skill = data.skill;
  } catch (err) { console.error('[SkillDetail] Failed to fetch skill:', err instanceof Error ? err.message : err); }

  try {
    const session = await auth();
    isSignedIn = !!session?.user;
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      instanceId = instanceData.instances[0]?.id ?? null;
    }
  } catch (err) { console.error('[SkillDetail] Failed to fetch user instances:', err instanceof Error ? err.message : err); }

  if (!skill) {
    return (
      <div className="min-h-screen bg-void">
        <SiteHeader />
        <div className="pt-24 pb-12">
          <div className="mx-auto max-w-3xl px-6 md:px-8">
            <Link href="/marketplace" className="flex items-center gap-1 text-sm text-text-secondary hover:text-white mb-6">
              <ArrowLeft className="h-4 w-4" />Back to Marketplace
            </Link>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h2 className="text-xl font-semibold mb-2">Skill not found</h2>
              <p className="text-sm text-text-secondary">The skill you are looking for does not exist or has been removed.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const catStyle = CATEGORY_STYLES[skill.category];
  const SkillIcon = getSkillIcon(skill.slug, skill.category);

  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <div className="pt-24 pb-12 md:pb-20">
        <div className="mx-auto max-w-3xl px-6 md:px-8">
          <Link href="/marketplace" className="flex items-center gap-1 text-sm text-text-secondary hover:text-white mb-6">
            <ArrowLeft className="h-4 w-4" />Back to Marketplace
          </Link>
          <div className="rounded border border-border bg-panel/30 p-6 md:p-8">
            <SkillHeader skill={skill} catStyle={catStyle} SkillIcon={SkillIcon} instanceId={instanceId} />
            {skill.description && (
              <div className="mb-6">
                <h2 className="text-sm font-medium text-text-primary mb-2">Description</h2>
                <p className="text-sm text-text-secondary leading-relaxed">{skill.description}</p>
              </div>
            )}
            <SkillStats skill={skill} />
            {instanceId && (
              <div className="mb-6">
                <RateSkillButton skillId={skill.id} />
              </div>
            )}
            {skill.githubUrl && (
              <a href={skill.githubUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-signal hover:text-signal-hover transition">
                <ExternalLink className="h-4 w-4" />View on GitHub
              </a>
            )}
            <SkillSignInPrompt instanceId={instanceId} isSignedIn={isSignedIn} skillSlug={skill.slug} />
          </div>
        </div>
      </div>
      <SkillDetailFooter />
    </div>
  );
}

function SkillSignInPrompt({ instanceId, isSignedIn, skillSlug }: {
  instanceId: string | null; isSignedIn: boolean; skillSlug: string;
}) {
  if (instanceId) return null;
  if (!isSignedIn) {
    return (
      <div className="mt-6 rounded-lg bg-surface/50 p-4 text-center">
        <p className="text-sm text-text-secondary">
          <Link href={`/sign-in?callbackUrl=/marketplace/${skillSlug}`} className="text-signal hover:text-signal-hover">Sign in</Link>{' '}
          and create an instance to install this skill.
        </p>
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-lg bg-surface/50 p-4 text-center">
      <p className="text-sm text-text-secondary">
        <Link href="/dashboard" className="text-signal hover:text-signal-hover">Create an instance</Link>{' '}
        to install this skill.
      </p>
    </div>
  );
}

function SkillHeader({ skill, catStyle, SkillIcon, instanceId }: {
  skill: SkillDetail; catStyle: { bg: string; color: string } | undefined;
  SkillIcon: React.ComponentType<{ className?: string }>; instanceId: string | null;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-start gap-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded ${catStyle?.bg ?? 'bg-surface'}`}>
          <SkillIcon className={`h-7 w-7 ${catStyle?.color ?? 'text-text-secondary'}`} />
        </div>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{skill.name}</h1>
            {skill.verificationStatus === 'approved' && (
              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs text-green-400">
                <CheckCircle className="h-3 w-3" />Verified
              </span>
            )}
          </div>
          <span className="text-sm text-text-dim">{SKILL_CATEGORY_LABELS[skill.category]}</span>
        </div>
      </div>
      {instanceId && skill.currentVersion && (
        <InstallSkillButton instanceId={instanceId} skillId={skill.id} skillVersion={skill.currentVersion} />
      )}
    </div>
  );
}

function SkillStats({ skill }: { skill: SkillDetail }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
      <div className="rounded-lg bg-surface/50 p-3">
        <div className="text-xs text-text-dim mb-1">Version</div>
        <div className="text-sm font-mono">{skill.currentVersion ?? 'N/A'}</div>
      </div>
      <div className="rounded-lg bg-surface/50 p-3">
        <div className="text-xs text-text-dim mb-1">Status</div>
        <div className="text-sm capitalize">{skill.verificationStatus}</div>
      </div>
      <div className="rounded-lg bg-surface/50 p-3">
        <div className="text-xs text-text-dim mb-1">Availability</div>
        <div className="text-sm text-signal">Early Access</div>
      </div>
    </div>
  );
}

function SkillDetailFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-7xl px-6 flex flex-col items-center gap-4 md:flex-row md:justify-between">
        <div className="flex items-center gap-2 text-sm text-text-dim">
          <Shield className="h-4 w-4" /><span>&copy; 2026 OpenSyber. All rights reserved.</span>
        </div>
        <div className="flex gap-6 text-sm text-text-dim">
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
          <Link href="/marketplace" className="hover:text-white transition">Skills</Link>
          <Link href="/docs" className="hover:text-white transition">Docs</Link>
          <Link href="/blog" className="hover:text-white transition">Blog</Link>
        </div>
      </div>
    </footer>
  );
}
