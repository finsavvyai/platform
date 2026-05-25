'use client';

import { useState } from 'react';

const PLANS = ['free', 'personal', 'pro', 'team'] as const;

interface ChangePlanSelectProps {
  userId: string;
  currentPlan: string;
}

export function ChangePlanSelect({ userId, currentPlan }: ChangePlanSelectProps) {
  const [plan, setPlan] = useState(currentPlan);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (newPlan: string) => {
    setPlan(newPlan);
    setLoading(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setPlan(currentPlan);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <select
          value={plan}
          onChange={(e) => handleChange(e.target.value)}
          disabled={loading}
          className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white
                     focus:border-teal-500/50 focus:outline-none disabled:opacity-50"
        >
          {PLANS.map((p) => (
            <option key={p} value={p} className="bg-panel">
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </option>
          ))}
        </select>
        {saved && <span className="text-xs text-teal-400">Saved</span>}
      </div>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
