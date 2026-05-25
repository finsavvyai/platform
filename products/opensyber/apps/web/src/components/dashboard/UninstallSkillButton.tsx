'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export function UninstallSkillButton({
  instanceId,
  skillId,
  skillName,
}: {
  instanceId: string;
  skillId: string;
  skillName: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleUninstall() {
    if (!confirm(`Uninstall "${skillName}" from your instance?`)) return;

    setLoading(true);

    try {
      const res = await fetch(
        `/api/proxy/instances/${instanceId}/skills/${skillId}`,
        { method: 'DELETE' },
      );

      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { message?: string }).message ?? 'Uninstall failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleUninstall}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg border border-wire px-2.5 py-1 text-xs text-text-secondary hover:bg-surface hover:text-red-400 transition disabled:opacity-50"
    >
      <Trash2 className="h-3 w-3" />
      {loading ? 'Removing...' : 'Uninstall'}
    </button>
  );
}
