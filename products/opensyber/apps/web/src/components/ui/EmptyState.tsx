import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function EmptyState({ icon: Icon, title, description, ctaLabel, ctaHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-700 bg-neutral-900/20 p-12 md:p-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-info/10 mb-6">
        <Icon className="h-8 w-8 text-info" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-neutral-400 text-sm max-w-md mb-6">{description}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 rounded-lg bg-info px-6 py-3 text-sm font-medium hover:bg-info transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
