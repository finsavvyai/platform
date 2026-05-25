import Link from 'next/link';
import { Store, Shield } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { SiteHeader } from '@/components/SiteHeader';
import { CATEGORY_STYLES } from './marketplace-utils';
import { SkillCardContent } from './SkillCardContent';

import type { SkillCategory, VerificationStatus } from '@opensyber/shared';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Skill Marketplace' };

interface MarketplaceSkill {
  id: string; slug: string; name: string; description: string | null;
  category: SkillCategory; currentVersion: string | null;
  verificationStatus: VerificationStatus; installCount: number;
  ratingAvg: number; ratingCount: number;
  isSigned?: boolean;
  hasSbom?: boolean;
}

const allCategories: SkillCategory[] = [
  'security', 'developer', 'productivity', 'communication', 'utilities', 'finance', 'home',
];

/** Mission-framed display labels for marketplace categories */
const MARKETPLACE_LABELS: Record<SkillCategory, string> = {
  security: 'Security',
  developer: 'CI/CD',
  productivity: 'AI Agents',
  communication: 'Alerts',
  utilities: 'Runtime',
  finance: 'Compliance',
  home: 'Infrastructure',
};

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const params = await searchParams;
  const filterCategory = params.category ?? null;
  let skills: MarketplaceSkill[] = [];
  let instanceId: string | null = null;
  let installedSkillIds = new Set<string>();

  try {
    const data = await apiClient<{ skills: MarketplaceSkill[] }>('/api/skills');
    skills = data.skills;
  } catch (err) { console.error('[Marketplace] Failed to fetch skills:', err instanceof Error ? err.message : err); }

  try {
    const token = await getApiToken();
    if (token) {
      const instanceData = await apiClient<{ instances: Array<{ id: string }> }>('/api/instances', { token });
      instanceId = instanceData.instances[0]?.id ?? null;
      if (instanceId) {
        const skillData = await apiClient<{ skills: Array<{ installation: { skillId: string } }> }>(
          `/api/instances/${instanceId}/skills`, { token },
        );
        installedSkillIds = new Set(skillData.skills.map((s) => s.installation.skillId));
      }
    }
  } catch (err) { console.error('[Marketplace] Failed to fetch user data:', err instanceof Error ? err.message : err); }

  const filteredSkills = filterCategory
    ? skills.filter((s) => s.category === filterCategory)
    : skills;

  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <main className="pt-36 pb-20 md:pb-28">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold">
              {skills.length > 0 ? `${skills.length} skills for AI agent security` : 'Skills for AI agent security'}
            </h1>
            <p className="text-sm text-text-secondary mt-1">Skills focused on attack patterns observed in recent AI agent incidents.</p>
          </div>
          <CategoryFilters filterCategory={filterCategory} allCategories={allCategories} />
          <BundleBanner />
          {filteredSkills.length === 0 ? (
            <EmptyState filterCategory={filterCategory} />
          ) : (
            <SkillGrid skills={filteredSkills} instanceId={instanceId} installedSkillIds={installedSkillIds} />
          )}
        </div>
      </main>
      <MarketplaceFooter />
    </div>
  );
}

function BundleBanner() {
  return (
    <Link
      href="/dashboard/marketplace?tab=bundles"
      className="flex items-center justify-between mb-8 rounded-2xl border border-info/15 bg-gradient-to-r from-info/[0.04] to-signal/[0.03] px-6 py-5 text-sm hover:border-info/30 transition group"
    >
      <div>
        <span className="font-semibold text-white">Skill bundles from $19/mo</span>
        <span className="block text-xs text-text-secondary mt-0.5">Pre-packaged skill sets for a specific security domain.</span>
      </div>
      <span className="text-signal font-medium group-hover:translate-x-1 transition-transform">View bundles &rarr;</span>
    </Link>
  );
}

function CategoryFilters({ filterCategory, allCategories: cats }: { filterCategory: string | null; allCategories: SkillCategory[] }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <Link href="/marketplace" className={`rounded-lg px-3.5 py-2 text-xs font-medium transition ${!filterCategory ? 'bg-signal text-void font-bold' : 'bg-surface border border-border text-text-secondary hover:border-signal/30 hover:text-text-primary'}`}>All</Link>
      {cats.map((cat) => {
        const style = CATEGORY_STYLES[cat];
        const CatIcon = style?.icon;
        return (
          <Link key={cat} href={`/marketplace?category=${cat}`}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition ${filterCategory === cat ? 'bg-signal text-void font-bold' : 'bg-surface border border-border text-text-secondary hover:border-signal/30 hover:text-text-primary'}`}>
            {CatIcon && <CatIcon className="h-3 w-3" />}{MARKETPLACE_LABELS[cat]}
          </Link>
        );
      })}
    </div>
  );
}

function EmptyState({ filterCategory }: { filterCategory: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4"><Store className="h-6 w-6 text-text-secondary" /></div>
      <h3 className="text-base font-semibold mb-1">No skills found</h3>
      <p className="text-sm text-text-secondary max-w-sm">
        {filterCategory ? 'No skills in this category yet. Check back soon!' : 'The marketplace is empty. Skills will appear here once published.'}
      </p>
    </div>
  );
}

function SkillGrid({ skills, instanceId, installedSkillIds }: {
  skills: MarketplaceSkill[]; instanceId: string | null; installedSkillIds: Set<string>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skills.map((skill) => (
        <SkillCardContent key={skill.id} skill={skill} instanceId={instanceId} isInstalled={installedSkillIds.has(skill.id)} />
      ))}
    </div>
  );
}

function MarketplaceFooter() {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="mx-auto max-w-7xl px-6 flex flex-col items-center gap-4 md:flex-row md:justify-between">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Shield className="h-4 w-4" /><span>&copy; 2026 OpenSyber. All rights reserved.</span>
        </div>
        <div className="flex gap-6 text-sm text-text-dim">
          <Link href="/pricing" className="hover:text-text-primary transition">Pricing</Link>
          <Link href="/marketplace" className="hover:text-text-primary transition">Skills</Link>
          <Link href="/docs" className="hover:text-text-primary transition">Docs</Link>
          <Link href="/demo" className="hover:text-text-primary transition">Demo</Link>
          <Link href="/blog" className="hover:text-text-primary transition">Blog</Link>
        </div>
      </div>
    </footer>
  );
}
