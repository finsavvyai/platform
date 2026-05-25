'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';

interface FeatureGateProps {
  feature: string;
  requiredPlan: string;
  children: React.ReactNode;
  currentPlan?: string;
}

export function FeatureGate({
  feature,
  requiredPlan,
  children,
  currentPlan,
}: FeatureGateProps): React.ReactElement {
  const planOrder = ['free', 'pro', 'team', 'enterprise'];
  const currentIdx = planOrder.indexOf(currentPlan ?? 'free');
  const requiredIdx = planOrder.indexOf(requiredPlan);

  if (currentIdx >= requiredIdx) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none opacity-30 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-xl border border-neutral-700 bg-neutral-900/95 p-6 text-center max-w-sm">
          <Lock className="h-8 w-8 text-neutral-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-2">{feature}</h3>
          <p className="text-sm text-neutral-400 mb-4">
            This feature requires the {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan.
          </p>
          <Link
            href="/pricing"
            className="inline-flex rounded-lg bg-info px-4 py-2 text-sm font-medium hover:bg-info transition"
          >
            Upgrade to {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
          </Link>
        </div>
      </div>
    </div>
  );
}
