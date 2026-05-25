'use client';

import { useState } from 'react';
import { Download, Check, AlertCircle, ArrowUpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function InstallSkillButton({
  instanceId,
  skillId,
  skillVersion,
  alreadyInstalled = false,
}: {
  instanceId: string;
  skillId: string;
  skillVersion: string;
  alreadyInstalled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [installed, setInstalled] = useState(alreadyInstalled);
  const [error, setError] = useState<string | null>(null);
  const [isPlanLimit, setIsPlanLimit] = useState(false);
  const router = useRouter();

  async function handleInstall() {
    setLoading(true);
    setError(null);
    setIsPlanLimit(false);

    try {
      const res = await fetch(
        `/api/proxy/instances/${instanceId}/skills`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skillId, version: skillVersion }),
        },
      );

      if (res.ok) {
        setInstalled(true);
        router.push(`/dashboard/skills/${skillId}/configure`);
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string; message?: string };
        const isLimit = data.error === 'Plan limit reached' || data.error === 'Plan restriction';
        setIsPlanLimit(isLimit);
        setError(data.message ?? 'Install failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (installed) {
    return (
      <span className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400">
        <Check className="h-3.5 w-3.5" />
        Installed
      </span>
    );
  }

  if (error && isPlanLimit) {
    return (
      <Link
        href="/pricing"
        className="flex items-center gap-1.5 rounded-lg bg-signal/10 border border-signal/30 px-3 py-1.5 text-xs font-medium text-signal hover:bg-signal/20 transition"
        title={error}
      >
        <ArrowUpCircle className="h-3.5 w-3.5" />
        Upgrade
      </Link>
    );
  }

  if (error) {
    return (
      <button
        onClick={handleInstall}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
        title={error}
      >
        <AlertCircle className="h-3.5 w-3.5" />
        {loading ? 'Retrying...' : 'Retry'}
      </button>
    );
  }

  return (
    <button
      onClick={handleInstall}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg bg-signal px-3 py-1.5 text-xs font-medium text-white hover:bg-signal-hover transition disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" />
      {loading ? 'Installing...' : 'Install'}
    </button>
  );
}
