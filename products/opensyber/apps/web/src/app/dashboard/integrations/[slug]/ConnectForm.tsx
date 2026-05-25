'use client';

import { useState } from 'react';
import { Plug, Loader2, CheckCircle } from 'lucide-react';
import type { Integration } from '../integrations-data';

export function ConnectForm({ integration }: { integration: Integration }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleConnect() {
    setStatus('loading');
    setError('');
    try {
      const res = await fetch('/api/proxy/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integrationSlug: integration.slug,
          config: values,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to connect');
      }
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="rounded border border-green-500/30 bg-green-500/5 p-6 text-center">
        <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
        <h3 className="font-semibold text-green-400 mb-1">Connected!</h3>
        <p className="text-xs text-text-secondary">
          {integration.name} is now sending events to your OpenSyber instance.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
        <Plug className="h-4 w-4 text-signal" />
        Connect {integration.name}
      </h2>

      <div className="space-y-4">
        {integration.configFields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              {field.label}
              {field.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {field.type === 'select' ? (
              <select
                className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white focus:border-signal focus:outline-none"
                value={values[field.key] || ''}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
              >
                <option value="">Select...</option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === 'password' ? 'password' : 'text'}
                className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-signal focus:outline-none"
                placeholder={field.placeholder || ''}
                value={values[field.key] || ''}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
              />
            )}
            {field.helpText && (
              <p className="text-[10px] text-text-dim mt-1">{field.helpText}</p>
            )}
          </div>
        ))}

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={handleConnect}
          disabled={status === 'loading'}
          className="w-full rounded-lg bg-signal px-4 py-2.5 text-sm font-medium text-white hover:bg-signal-hover disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Connecting...</>
          ) : (
            <><Plug className="h-4 w-4" /> Connect</>
          )}
        </button>
      </div>
    </div>
  );
}
