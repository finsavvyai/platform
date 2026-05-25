'use client';

import { useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { BundleCard } from '@/components/dashboard/BundleCard';
import type { BundleData } from '@/components/dashboard/BundleCard';

interface Props {
  bundles: BundleData[];
}

export function BundleGrid({ bundles }: Props) {
  const router = useRouter();

  if (bundles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Sparkles className="h-8 w-8 text-text-dim mb-3" aria-hidden="true" />
        <h3 className="text-base font-semibold mb-1">No bundles available</h3>
        <p className="text-sm text-text-secondary max-w-sm">
          Bundles will appear here once they are published.
        </p>
      </div>
    );
  }

  const freeBundles = bundles.filter((b) => b.priceCents === 0);
  const paidBundles = bundles.filter((b) => b.priceCents > 0);

  async function handleActivate(bundleId: string) {
    try {
      const res = await fetch('/api/proxy/bundles/' + bundleId + '/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      // Activation failed silently; user can retry
    }
  }

  return (
    <div className="space-y-8">
      {freeBundles.length > 0 && (
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-green-400" aria-hidden="true" />
            Free Starter Bundles
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {freeBundles.map((b) => (
              <BundleCard key={b.id} bundle={b} onActivate={handleActivate} />
            ))}
          </div>
        </div>
      )}

      {paidBundles.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">
            Pro Bundles
            <span className="ml-2 text-sm font-normal text-text-dim">({paidBundles.length})</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paidBundles.map((b) => (
              <BundleCard key={b.id} bundle={b} onActivate={handleActivate} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
