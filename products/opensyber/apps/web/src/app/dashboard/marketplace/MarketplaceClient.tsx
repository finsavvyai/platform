'use client';

import { useState } from 'react';
import { Search, Crown, Package } from 'lucide-react';
import { InstallModal } from './InstallModal';
import { MarketplaceEmpty } from './MarketplaceEmpty';
import { SkillSuggestions } from './SkillSuggestions';
import { SkillCard } from './SkillCard';
import { BundleGrid } from './BundleGrid';
import type { Skill } from './SkillCard';
import type { BundleData } from '@/components/dashboard/BundleCard';

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

interface PlanUsage {
  installedCount: number;
  limit: number | null;
  plan: string;
}

interface Props {
  skills: Skill[];
  featured: Skill[];
  agents: Instance[];
  recommendations?: Recommendation[];
  installedSkillIds?: string[];
  bundles?: BundleData[];
  initialTab?: string;
  planUsage?: PlanUsage | null;
}

const CATEGORIES = ['All', 'Security', 'CI/CD', 'AI Agents', 'Runtime', 'Compliance', 'Alerts', 'Infrastructure'];
const TABS = [{ id: 'skills', label: 'All Skills' }, { id: 'bundles', label: 'Bundles' }] as const;
const CATEGORY_MAP: Record<string, string> = { All: 'All', Security: 'security', 'CI/CD': 'developer', 'AI Agents': 'productivity', Runtime: 'utilities', Compliance: 'finance', Alerts: 'communication', Infrastructure: 'home' };

export function MarketplaceClient({ skills, featured, agents, recommendations = [], installedSkillIds = [], bundles = [], initialTab = 'skills', planUsage }: Props) {
  const installedSet = new Set(installedSkillIds);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [installSkill, setInstallSkill] = useState<Skill | null>(null);

  const featuredIds = new Set(featured.map((s) => s.id));
  const showFeatured = featured.length > 0 && !search && category === 'All';

  const filtered = skills.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(q) || (s.description?.toLowerCase().includes(q) ?? false);
    const mappedCategory = CATEGORY_MAP[category] ?? 'All';
    const matchCategory = mappedCategory === 'All' || s.category === mappedCategory;
    const notDuplicated = !showFeatured || !featuredIds.has(s.id);
    return matchSearch && matchCategory && notDuplicated;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          {skills.length > 0 ? `${skills.length} skills for AI agent security` : 'Skills for AI agent security'}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Skills focused on attack patterns observed in recent AI agent incidents.
        </p>
      </div>

      {planUsage && planUsage.limit !== null && (
        <div className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
          planUsage.installedCount >= planUsage.limit
            ? 'border-red-500/30 bg-red-500/10 text-red-400'
            : planUsage.installedCount >= planUsage.limit * 0.8
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-border bg-surface text-text-secondary'
        }`}>
          <span>
            Skills installed: <strong>{planUsage.installedCount}/{planUsage.limit}</strong> ({planUsage.plan} plan)
          </span>
          {planUsage.installedCount >= planUsage.limit && (
            <a href="/pricing" className="text-xs underline hover:text-white transition">Upgrade plan</a>
          )}
        </div>
      )}

      {/* Tab bar: Skills / Bundles */}
      <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Marketplace sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors min-h-[44px] ${
              activeTab === tab.id
                ? 'border-signal text-white'
                : 'border-transparent text-text-secondary hover:text-white'
            }`}
          >
            {tab.id === 'bundles' && <Package className="h-4 w-4" aria-hidden="true" />}
            {tab.label}
            {tab.id === 'bundles' && bundles.length > 0 && (
              <span className="rounded-full bg-surface px-1.5 text-[10px]">{bundles.length}</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'bundles' ? (
        <BundleGrid bundles={bundles} />
      ) : (
      <>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Skill categories">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            role="tab"
            aria-selected={category === cat}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 min-h-[44px] ${
              category === cat
                ? 'bg-info text-white'
                : 'bg-surface text-text-secondary hover:bg-neutral-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" aria-hidden="true" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search skills..."
          aria-label="Search skills"
          className="w-full rounded-lg border border-border bg-panel py-3 pl-10 pr-4 text-sm min-h-[44px] focus:border-signal focus:outline-none transition-colors duration-200"
        />
      </div>

      {recommendations.length > 0 && !search && (
        <SkillSuggestions
          recommendations={recommendations}
          installedSkillIds={installedSkillIds}
          agents={agents}
          onInstall={(skillId) => {
            const skill = skills.find((s) => s.id === skillId);
            if (skill) setInstallSkill(skill);
          }}
        />
      )}

      {showFeatured && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Crown className="h-5 w-5 text-amber-400" aria-hidden="true" /> Featured
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((s) => (
              <SkillCard key={s.id} skill={s} onInstall={setInstallSkill} isInstalled={installedSet.has(s.id)} />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-lg font-semibold">
          {category === 'All' ? 'All Skills' : category}
          <span className="ml-2 text-sm font-normal text-text-dim">({filtered.length})</span>
        </h2>
        {filtered.length === 0 ? (
          <MarketplaceEmpty />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <SkillCard key={s.id} skill={s} onInstall={setInstallSkill} isInstalled={installedSet.has(s.id)} />
            ))}
          </div>
        )}
      </div>

      </>
      )}

      {installSkill && (
        <InstallModal skill={installSkill} agents={agents} onClose={() => setInstallSkill(null)} />
      )}
    </div>
  );
}
