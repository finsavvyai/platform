/**
 * Single tile for the SSE admin overview. Renders count + label or an
 * error chip when the API is unreachable. Tap-target conforming to
 * Apple HIG (>=44px tappable height).
 */

import Link from 'next/link';
import type { ReactElement } from 'react';
import { ArrowUpRight, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SseTileProps {
  title: string;
  subtitle: string;
  count: number | null;
  unit: string;
  href: string;
  icon: LucideIcon;
  accent: string;
}

export function SseTile({
  title,
  subtitle,
  count,
  unit,
  href,
  icon: Icon,
  accent,
}: SseTileProps): ReactElement {
  const unreachable = count === null;

  return (
    <Link
      href={href}
      data-testid={`sse-tile-${title.toLowerCase().replace(/\s+/g, '-')}`}
      className="group block rounded border border-border bg-panel/30 p-6 transition hover:border-border-strong hover:bg-panel/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-text-secondary">{title}</p>
        <Icon aria-hidden className={`h-5 w-5 ${accent}`} />
      </div>

      <div className="flex items-baseline gap-2">
        {unreachable ? (
          <span aria-label="API unreachable" className="text-3xl font-semibold text-text-tertiary">
            —
          </span>
        ) : (
          <span className="text-3xl font-semibold">{count}</span>
        )}
        <span className="text-xs text-text-secondary">{unit}</span>
      </div>

      <p className="mt-1 text-xs text-text-tertiary">{subtitle}</p>

      <div className="mt-4 flex items-center justify-between text-xs text-text-secondary">
        {unreachable ? (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-red-400">
            <AlertCircle className="h-3 w-3" aria-hidden />
            unreachable
          </span>
        ) : (
          <span>configured</span>
        )}
        <ArrowUpRight
          aria-hidden
          className="h-4 w-4 text-text-tertiary transition group-hover:text-text-primary"
        />
      </div>
    </Link>
  );
}
