'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ResidencyFormProps {
  orgId: string;
  current: { region: string; enforceStrict: boolean } | null;
}

const REGIONS = [
  { value: 'eu', label: 'Europe (EU)', flag: '🇪🇺', description: 'Frankfurt (eu-central)' },
  { value: 'us', label: 'United States', flag: '🇺🇸', description: 'Virginia (us-east), Oregon (us-west)' },
  { value: 'ap', label: 'Asia Pacific', flag: '🌏', description: 'Singapore (ap-southeast)' },
];

export function ResidencyForm({ orgId, current }: ResidencyFormProps) {
  const [region, setRegion] = useState(current?.region || '');
  const [enforceStrict, setEnforceStrict] = useState(current?.enforceStrict ?? false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async () => {
    if (!region) { setMessage('Select a region'); return; }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/proxy/organizations/${orgId}/residency`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, enforceStrict }),
      });
      if (res.ok) {
        setMessage('Residency configuration saved');
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage((data as { message?: string }).message || 'Failed to save');
      }
    } catch {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {REGIONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setRegion(r.value)}
            className={`flex items-center gap-4 rounded border p-4 text-left transition ${
              region === r.value
                ? 'border-info bg-signal/10'
                : 'border-border bg-panel/30 hover:border-wire'
            }`}
          >
            <span className="text-2xl">{r.flag}</span>
            <div>
              <p className="font-medium">{r.label}</p>
              <p className="text-xs text-text-secondary">{r.description}</p>
            </div>
          </button>
        ))}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={enforceStrict}
          onChange={(e) => setEnforceStrict(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-600 bg-surface text-signal"
        />
        <div>
          <p className="text-sm font-medium">Strict enforcement</p>
          <p className="text-xs text-text-secondary">Block instance creation outside the selected region</p>
        </div>
      </label>

      {current && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <p className="text-xs text-amber-400">
            Changing your region policy will not move existing instances.
            Only new instances will be subject to the updated policy.
          </p>
        </div>
      )}

      {message && (
        <p className={`text-sm ${message.includes('saved') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}

      <button
        onClick={handleSave}
        disabled={loading || !region}
        className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Configuration
      </button>
    </div>
  );
}
