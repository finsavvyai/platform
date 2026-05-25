import Link from 'next/link';
import type { ReactNode } from 'react';
import { Lock, ArrowRight, Check } from 'lucide-react';

export interface UpgradePromptProps {
  feature: string;
  requiredPlan?: string;
  /** One-line ROI pitch — be specific: "Catch 94% of exposed secrets across 1,000 repos" */
  valueProp?: string;
  /** Bullet list of what the user unlocks on upgrade — be concrete */
  unlocks?: readonly string[];
  /** Optional locked preview — rendered behind a blur so users see what they're missing */
  preview?: ReactNode;
  /** Override CTA target (defaults to /pricing) */
  ctaHref?: string;
}

const DEFAULT_UNLOCKS: readonly string[] = [
  'Save 40+ hours/month on manual security triage',
  'Catch breaches in 340ms instead of 204 days',
  'Sleep through the next supply-chain attack',
];

/**
 * Contextual paywall with locked feature preview + specific ROI.
 * Unlike a generic lock screen, this shows users WHAT they're missing and WHY it matters.
 */
export function UpgradePrompt({
  feature,
  requiredPlan = 'Team',
  valueProp,
  unlocks = DEFAULT_UNLOCKS,
  preview,
  ctaHref = '/pricing',
}: UpgradePromptProps) {
  return (
    <div className="relative overflow-hidden rounded border border-border bg-panel/30">
      {preview && (
        <div
          className="pointer-events-none select-none blur-[6px] opacity-40"
          aria-hidden="true"
          data-testid="upgrade-preview"
        >
          {preview}
        </div>
      )}

      <div
        className={`${preview ? 'absolute inset-0' : ''} flex flex-col items-center justify-center p-8 md:p-12 text-center bg-gradient-to-b from-panel/80 via-panel/95 to-panel`}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-signal/10 border border-signal/20 mb-5">
          <Lock className="h-6 w-6 text-signal" aria-hidden="true" />
        </div>

        <p className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.2em] text-signal mb-2">
          {requiredPlan} plan
        </p>
        <h3 className="text-xl font-semibold mb-2 text-text-primary">{feature}</h3>
        <p className="text-sm text-text-secondary mb-6 max-w-md">
          {valueProp ?? `Unlock ${feature} and stop triaging findings by hand.`}
        </p>

        <ul className="w-full max-w-sm mb-7 space-y-2 text-left">
          {unlocks.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-primary">
              <Check className="h-4 w-4 mt-0.5 text-ok flex-shrink-0" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 rounded bg-signal px-6 py-3 text-sm font-[family-name:var(--font-mono)] uppercase tracking-wider font-bold text-void hover:bg-signal-hover transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
        >
          Unlock {requiredPlan} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-xs text-text-dim">
          14-day trial. No credit card. Cancel with one click.
        </p>
      </div>
    </div>
  );
}
