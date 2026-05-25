import Link from 'next/link';
import { Package } from 'lucide-react';

const steps = [
  'Browse the marketplace',
  'Install a skill',
  'Configure permissions',
  'Activate',
];

export function SkillsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-6">
        <Package className="h-6 w-6 text-text-secondary" />
      </div>
      <h3 className="text-base font-semibold mb-2">No skills installed</h3>
      <p className="text-sm text-text-secondary max-w-sm mb-6">
        Get started in four steps:
      </p>
      <ol className="text-sm text-text-secondary space-y-2 mb-6 text-left">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-signal/20 text-xs font-bold text-signal">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <Link
        href="/dashboard/marketplace"
        className="rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition"
      >
        Browse Marketplace &rarr;
      </Link>
    </div>
  );
}
