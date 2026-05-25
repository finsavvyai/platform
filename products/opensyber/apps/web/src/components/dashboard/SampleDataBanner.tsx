'use client';

import { FlaskConical } from 'lucide-react';

/**
 * Prominent banner shown on dashboard pages that display sample/demo data
 * instead of real customer data. Ensures users never mistake fabricated
 * security metrics for their actual environment.
 */
export function SampleDataBanner() {
  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <FlaskConical className="h-5 w-5 text-amber-400 shrink-0" />
      <div>
        <p className="text-sm font-medium text-amber-300">
          Sample Data Preview
        </p>
        <p className="text-xs text-amber-400/70">
          This page shows example data to demonstrate the feature. Connect your infrastructure to see real results.
        </p>
      </div>
    </div>
  );
}
