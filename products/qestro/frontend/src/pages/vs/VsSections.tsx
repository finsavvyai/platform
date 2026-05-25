import { CheckCircle2 } from 'lucide-react';
import type { PricingTier } from './vs-types';

/**
 * Small presentational primitives for the comparison page. Extracted to keep
 * VsPageLayout.tsx under the 200-line portfolio cap and to make the layout
 * readable as a storyboard of sections.
 */

export const VerdictCard = ({
  tone,
  title,
  body,
}: {
  tone: 'qestro' | 'competitor' | 'neutral';
  title: string;
  body: string;
}) => {
  const accent =
    tone === 'qestro' ? 'var(--brand-primary, #00F0FF)'
      : tone === 'competitor' ? '#f59e0b'
      : 'var(--text-muted)';
  return (
    <div
      className="rounded-xl p-6"
      style={{
        border: `1px solid color-mix(in srgb, ${accent} 30%, transparent)`,
        backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 60%, transparent)',
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4" style={{ color: accent }} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {body}
      </p>
    </div>
  );
};

export const PricingColumn = ({
  title,
  tiers,
  highlight = false,
}: {
  title: string;
  tiers: PricingTier[];
  highlight?: boolean;
}) => (
  <div
    className="rounded-xl p-6"
    style={{
      border: highlight
        ? '1px solid color-mix(in srgb, var(--brand-primary, #00F0FF) 40%, transparent)'
        : '1px solid color-mix(in srgb, var(--text-muted) 25%, transparent)',
      backgroundColor: 'color-mix(in srgb, var(--bg-secondary) 60%, transparent)',
    }}
  >
    <h3
      className="mb-4 text-xl font-bold"
      style={{ color: highlight ? 'var(--brand-primary)' : 'var(--text-primary)' }}
    >
      {title}
    </h3>
    <ul className="space-y-4">
      {tiers.map((t) => (
        <li
          key={t.tier}
          className="border-t pt-4 first:border-t-0 first:pt-0"
          style={{ borderColor: 'color-mix(in srgb, var(--text-muted) 15%, transparent)' }}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{t.tier}</span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {t.price}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {t.notes}
          </p>
        </li>
      ))}
    </ul>
  </div>
);
