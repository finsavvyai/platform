'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SkillToggleButton({
  instanceId,
  skillId,
  initialActive,
}: {
  instanceId: string;
  skillId: string;
  initialActive: boolean;
}) {
  const [active, setActive] = useState(initialActive);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    const next = !active;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/proxy/instances/${instanceId}/skills/${skillId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: next }),
        },
      );

      if (res.ok) {
        setActive(next);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { message?: string }).message ?? 'Failed to update');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      aria-label={active ? 'Deactivate skill' : 'Activate skill'}
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
        border border-transparent transition-colors duration-200
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/50
        disabled:cursor-not-allowed disabled:opacity-50
        ${active ? 'bg-green-500' : 'bg-neutral-700'}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm
          transform transition-transform duration-200
          ${active ? 'translate-x-4' : 'translate-x-0.5'}
        `}
      />
    </button>
  );
}
