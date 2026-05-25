import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export type LimitKind = 'agents' | 'skills' | 'alerts' | 'repos' | 'retention';

interface LimitConfig {
  title: string;
  valueProp: string;
  suggestedPlan: 'Team' | 'Professional';
}

const LIMIT_CONFIG: Record<LimitKind, LimitConfig> = {
  agents: {
    title: 'Agent limit reached',
    valueProp:
      'Free plan caps you at 1 agent. Team gets 3, Professional gets 10 — enough to cover every prod environment without rotating credentials.',
    suggestedPlan: 'Team',
  },
  skills: {
    title: 'Skill catalog locked',
    valueProp:
      'You have 3 of 47 skills. The 44 you\'re missing catch the stuff that actually breaches orgs — IAM drift, toxic combos, supply chain worms.',
    suggestedPlan: 'Team',
  },
  alerts: {
    title: 'Alert routing locked',
    valueProp:
      'Slack, PagerDuty, SIEM, and on-call rotations are on Team and up. Because email alerts at 3am don\'t page anyone.',
    suggestedPlan: 'Team',
  },
  repos: {
    title: 'GitHub repo limit reached',
    valueProp:
      'Free connects 1 repo. Team unlocks unlimited repos across your org — because modern codebases are not monoliths.',
    suggestedPlan: 'Team',
  },
  retention: {
    title: 'Audit log retention: 3 days',
    valueProp:
      'SOC 2 auditors want 1 year of logs. Professional keeps 365 days. Team keeps 30. Free keeps 3 — pick your regulator.',
    suggestedPlan: 'Professional',
  },
};

export interface LimitReachedBannerProps {
  kind: LimitKind;
  /** Current count (e.g., "1 of 1 agents used") */
  current?: number;
  /** Limit for this plan */
  limit?: number;
  /** Override plan CTA */
  plan?: 'Team' | 'Professional';
}

/**
 * Inline contextual upgrade nudge shown when a free user hits a quota ceiling.
 * Apple HIG: calm, specific, actionable — not a modal, not a dark pattern.
 */
export function LimitReachedBanner({
  kind,
  current,
  limit,
  plan,
}: LimitReachedBannerProps) {
  const cfg = LIMIT_CONFIG[kind];
  const targetPlan = plan ?? cfg.suggestedPlan;

  return (
    <div
      role="region"
      aria-label={cfg.title}
      className="mb-6 overflow-hidden rounded border border-warn/30 bg-warn/[0.04]"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 md:p-6">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-warn/10 border border-warn/20">
            <AlertTriangle className="h-5 w-5 text-warn" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-text-primary">{cfg.title}</h3>
              {typeof current === 'number' && typeof limit === 'number' && (
                <span
                  className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wider text-warn"
                  data-testid="limit-counter"
                >
                  {current} / {limit} used
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-text-secondary leading-relaxed">{cfg.valueProp}</p>
          </div>
        </div>
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center gap-2 rounded bg-signal px-5 py-2.5 text-xs font-[family-name:var(--font-mono)] uppercase tracking-wider font-bold text-void hover:bg-signal-hover transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          Upgrade to {targetPlan} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
