'use client';

import { Check, Sparkles } from 'lucide-react';

interface BundleSkill {
  skillId: string;
  skillName: string;
  skillSlug: string;
  skillCategory: string;
}

export interface BundleData {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  tier: string;
  priceCents: number;
  skillCount: number;
  icon: string | null;
  skills: BundleSkill[];
  isSubscribed: boolean;
}

const accentGradients: Record<string, string> = {
  free: 'from-green-500 to-emerald-600',
  pro: 'from-signal to-cyan-600',
  team: 'from-info to-info',
  enterprise: 'from-purple-500 to-violet-600',
};

const tierLabels: Record<string, string> = {
  free: 'Free', pro: 'Pro', team: 'Team', enterprise: 'Enterprise',
};

interface Props {
  bundle: BundleData;
  onActivate: (bundleId: string) => void;
}

export function BundleCard({ bundle, onActivate }: Props) {
  const gradient = accentGradients[bundle.tier] ?? accentGradients.free;
  const individualPrice = bundle.skills.length * 999; // $9.99 per skill estimate
  const savings = individualPrice > 0 && bundle.priceCents > 0
    ? Math.round((1 - bundle.priceCents / individualPrice) * 100)
    : 0;

  return (
    <div className="group rounded border border-border bg-panel/30 overflow-hidden transition-colors hover:border-wire">
      {/* Accent gradient bar */}
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />

      <div className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold">{bundle.name}</h3>
            {bundle.tagline && (
              <p className="mt-0.5 text-xs text-text-secondary">{bundle.tagline}</p>
            )}
          </div>
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-secondary">
            {tierLabels[bundle.tier] ?? bundle.tier}
          </span>
        </div>

        {/* Skills chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {bundle.skills.slice(0, 5).map((s) => (
            <span
              key={s.skillId}
              className="rounded bg-surface px-2 py-0.5 text-[10px] text-text-secondary"
            >
              {s.skillName}
            </span>
          ))}
          {bundle.skills.length > 5 && (
            <span className="rounded bg-surface px-2 py-0.5 text-[10px] text-text-dim">
              +{bundle.skills.length - 5} more
            </span>
          )}
        </div>

        {/* Pricing */}
        <div className="mt-4 flex items-end justify-between">
          <div>
            {bundle.priceCents === 0 ? (
              <span className="text-sm font-semibold text-green-400">Free</span>
            ) : (
              <div className="flex items-baseline gap-2">
                {savings > 0 && (
                  <span className="text-xs text-text-dim line-through">
                    ${(individualPrice / 100).toFixed(0)}
                  </span>
                )}
                <span className="text-sm font-semibold">
                  ${(bundle.priceCents / 100).toFixed(0)}/mo
                </span>
                {savings > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-signal">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Save {savings}%
                  </span>
                )}
              </div>
            )}
          </div>

          {bundle.isSubscribed ? (
            <span className="flex items-center gap-1 rounded-lg bg-green-500/10 px-4 py-2 text-xs font-medium text-green-400 min-h-[44px]">
              <Check className="h-3 w-3" aria-hidden="true" /> Active
            </span>
          ) : (
            <button
              onClick={() => onActivate(bundle.id)}
              className="rounded-lg bg-signal px-4 py-2 text-xs font-medium text-white min-h-[44px] transition-colors hover:bg-signal-hover"
              aria-label={`Activate ${bundle.name}`}
            >
              Activate Bundle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
