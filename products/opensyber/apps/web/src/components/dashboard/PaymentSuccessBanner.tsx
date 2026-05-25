'use client';

import { useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

export function PaymentSuccessBanner() {
  const params = useSearchParams();

  if (params.get('payment') !== 'success') return null;

  return (
    <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
      <CheckCircle className="h-4 w-4 flex-shrink-0" />
      <span>Payment successful! Your plan has been activated. It may take a moment to update.</span>
    </div>
  );
}
