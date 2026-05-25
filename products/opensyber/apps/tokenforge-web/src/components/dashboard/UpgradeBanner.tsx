'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';

interface UpgradeBannerProps {
  plan?: string;
  usage?: number;
  limit?: number;
}

export function UpgradeBanner({ plan, usage, limit }: UpgradeBannerProps): React.ReactElement | null {
  if (plan === 'team' || plan === 'enterprise') return null;

  const percent = limit && limit > 0 ? Math.round((usage ?? 0) / limit * 100) : 0;
  const isUrgent = percent >= 70;

  return (
    <div className={`mb-6 rounded-xl border p-4 flex items-center justify-between ${
      isUrgent
        ? 'border-amber-500/30 bg-amber-500/5'
        : 'border-info/20 bg-info/5'
    }`}>
      <div className="flex items-center gap-3">
        <Zap className={`h-5 w-5 ${isUrgent ? 'text-amber-400' : 'text-info'}`} />
        <div>
          {isUrgent ? (
            <p className="text-sm font-medium text-amber-300">
              {percent}% of your free tier used ({usage?.toLocaleString()} / {limit?.toLocaleString()})
            </p>
          ) : (
            <p className="text-sm font-medium">
              You&apos;re on the <span className="capitalize">{plan ?? 'Free'}</span> plan
            </p>
          )}
          <p className="text-xs text-neutral-400">
            {plan === 'pro'
              ? 'Upgrade to Team for zero-code proxy + compliance reports'
              : 'Upgrade to Pro for 50x more verifications + webhook alerts'}
          </p>
        </div>
      </div>
      <Link
        href="/pricing"
        className={`shrink-0 rounded-lg px-4 py-2 text-xs font-medium transition ${
          isUrgent
            ? 'bg-amber-500 text-black hover:bg-amber-400'
            : 'bg-info hover:bg-info'
        }`}
      >
        Upgrade
      </Link>
    </div>
  );
}
