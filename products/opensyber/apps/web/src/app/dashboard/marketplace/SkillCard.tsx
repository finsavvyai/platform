'use client';

import {
  Package, Shield, Plus, Check,
} from 'lucide-react';

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

const tierColors: Record<string, string> = {
  free: 'bg-green-500/10 text-green-400',
  pro: 'bg-signal/10 text-signal',
  premium: 'bg-amber-500/10 text-amber-400',
};

export type { Skill };

export function SkillCard({ skill, onInstall, isInstalled = false }: { skill: Skill; onInstall: (s: Skill) => void; isInstalled?: boolean }) {
  const Icon = skill.isCertified ? Shield : Package;
  const iconColor = skill.isCertified ? 'text-cyan-400' : 'text-signal';
  return (
    <div className="group rounded border border-border bg-panel/30 p-5 transition-colors duration-200 hover:border-wire">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface">
            <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-medium">{skill.name}</h3>
            <p className="text-xs text-text-dim capitalize">{skill.category}</p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${tierColors[skill.tier] ?? ''}`}>{skill.tier}</span>
      </div>
      <p className="mt-3 line-clamp-2 text-xs text-text-secondary">{skill.description ?? 'No description'}</p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-text-dim">
          {skill.isCertified && (
            <span className="flex items-center gap-1 text-green-400">
              <Shield className="h-3 w-3" aria-hidden="true" /> Verified
            </span>
          )}
          {skill.isSigned && (
            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-cyan-300">Signed</span>
          )}
          {skill.hasSbom && (
            <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-purple-300">SBOM</span>
          )}
          <span className="flex items-center gap-1 text-signal">Early Access</span>
        </div>
        {isInstalled ? (
          <span className="flex items-center gap-1 rounded-lg bg-green-500/10 px-4 py-2 text-xs font-medium text-green-400 min-h-[44px]">
            <Check className="h-3 w-3" aria-hidden="true" /> Installed
          </span>
        ) : (
          <button
            onClick={() => onInstall(skill)}
            className="flex items-center gap-1 rounded-lg bg-signal px-4 py-2 text-xs font-medium text-white min-h-[44px] transition-colors duration-200 hover:bg-signal-hover"
            aria-label={`Install ${skill.name}`}
          >
            <Plus className="h-3 w-3" aria-hidden="true" /> Install
          </button>
        )}
      </div>
    </div>
  );
}
