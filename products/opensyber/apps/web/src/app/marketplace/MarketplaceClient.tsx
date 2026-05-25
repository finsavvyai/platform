'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Store, Download } from 'lucide-react';
import { SKILL_CATEGORY_LABELS } from '@opensyber/shared';
import type { SkillCategory } from '@opensyber/shared';
import { InstallSkillButton } from '@/components/marketplace/InstallSkillButton';
import { SkillGrid, SkillCard } from '@/components/marketplace/SkillGrid';
import { MarketplaceSearch } from '@/components/marketplace/MarketplaceSearch';
import { FeaturedSkills } from '@/components/marketplace/FeaturedSkills';
import { CATEGORY_STYLES, SkillIconRenderer, renderStars } from './marketplace-utils';
import type { MarketplaceSkill } from './demo-skills';

const ALL_CATEGORIES: SkillCategory[] = [
  'productivity', 'developer', 'finance', 'communication', 'home', 'security', 'utilities',
];

interface Props {
  skills: MarketplaceSkill[];
  instanceId: string | null;
  initialCategory: string | null;
}

export function MarketplacePageClient({ skills, instanceId, initialCategory }: Props) {
  const [category, setCategory] = useState<string | null>(initialCategory);
  const [search, setSearch] = useState('');

  const filtered = skills.filter((s) => {
    if (category && s.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.description?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  return (
    <>
      <FeaturedSkills skills={skills} />
      <MarketplaceSearch onSearch={setSearch} />

      <div className="mb-6 flex flex-wrap gap-2">
        <button onClick={() => setCategory(null)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${!category ? 'bg-info text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>
          All
        </button>
        {ALL_CATEGORIES.map((cat) => {
          const style = CATEGORY_STYLES[cat];
          const CatIcon = style?.icon;
          return (
            <button key={cat} onClick={() => setCategory(cat === category ? null : cat)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${category === cat ? 'bg-info text-white' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>
              {CatIcon && <CatIcon className="h-3 w-3" />}{SKILL_CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <Store className="h-6 w-6 text-neutral-400" />
          </div>
          <h3 className="text-base font-semibold mb-1">No skills found</h3>
          <p className="text-sm text-neutral-400 max-w-sm">
            {search ? `No skills matching "${search}"` : 'No skills in this category yet.'}
          </p>
        </div>
      ) : (
        <SkillGrid>
          {filtered.map((skill) => (
            <SkillCardItem key={skill.id} skill={skill} instanceId={instanceId} />
          ))}
        </SkillGrid>
      )}
    </>
  );
}

function SkillCardItem({ skill, instanceId }: { skill: MarketplaceSkill; instanceId: string | null }) {
  const catStyle = CATEGORY_STYLES[skill.category];
  return (
    <SkillCard>
      <div className="flex items-start gap-3 mb-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${catStyle?.bg ?? 'bg-neutral-800'}`}>
          <SkillIconRenderer slug={skill.slug} category={skill.category} className={`h-5 w-5 ${catStyle?.color ?? 'text-neutral-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <Link href={`/marketplace/${skill.slug}`} className="font-semibold hover:text-info transition">
                {skill.name}
              </Link>
              <span className="block text-xs text-neutral-500">{SKILL_CATEGORY_LABELS[skill.category]}</span>
            </div>
            {skill.verificationStatus === 'approved' && (
              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400 shrink-0 ml-2">
                Verified
              </span>
            )}
          </div>
        </div>
      </div>
      {skill.description && <p className="text-sm text-neutral-400 mb-3 line-clamp-2">{skill.description}</p>}
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <div className="flex items-center gap-1">
          {renderStars(skill.ratingAvg)}
          {skill.ratingCount > 0 && <span className="ml-1">({skill.ratingCount})</span>}
        </div>
        <div className="flex items-center gap-3">
          {instanceId && skill.currentVersion ? (
            <InstallSkillButton instanceId={instanceId} skillId={skill.id} skillVersion={skill.currentVersion} />
          ) : (
            <>
              <span className="flex items-center gap-1"><Download className="h-3 w-3" />{skill.installCount}</span>
              {skill.currentVersion && <span className="font-mono">v{skill.currentVersion}</span>}
            </>
          )}
        </div>
      </div>
    </SkillCard>
  );
}
