'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';

interface Props {
  bundleId: string;
  isSubscribed: boolean;
}

export function ActivateBundleButton({ bundleId, isSubscribed }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(isSubscribed);

  async function handleActivate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/bundles/${bundleId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        setActivated(true);
        router.refresh();
      }
    } catch {
      // Activation failed
    } finally {
      setLoading(false);
    }
  }

  if (activated) {
    return (
      <span className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 px-6 py-3 text-sm font-medium text-green-400 min-h-[44px]">
        <CheckCircle className="h-4 w-4" aria-hidden="true" />
        Bundle Active
      </span>
    );
  }

  return (
    <button
      onClick={handleActivate}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg bg-signal px-6 py-3 text-sm font-medium text-white min-h-[44px] transition-colors hover:bg-signal-hover disabled:opacity-50"
      aria-label="Activate this bundle"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {loading ? 'Activating...' : 'Activate Bundle'}
    </button>
  );
}
