'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

type Provider = 'aws' | 'azure' | 'gcp';

interface Props {
  provider: Provider;
  credentials: Record<string, string>;
  onSuccess: () => void;
  onRetry: () => void;
}

interface ValidationResult {
  valid: boolean;
  identity?: string;
  error?: string;
}

export function ValidationStep({ provider, credentials, onSuccess, onRetry }: Props) {
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/proxy/cloud/accounts/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, credentials }),
    })
      .then((r) => r.json())
      .then((d) => setResult(d.data ?? d))
      .catch(() => setResult({ valid: false, error: 'Network error during validation.' }))
      .finally(() => setLoading(false));
  }, [provider, credentials]);

  async function saveAndFinish() {
    setSaving(true);
    setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        provider,
        name: `${provider.toUpperCase()} Account`,
        credentials,
        scanSchedule: 'daily',
      };
      if (provider === 'aws' && credentials.roleArn) {
        body.roleArn = credentials.roleArn;
      }
      const res = await fetch('/api/proxy/cloud/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError((data as { message?: string }).message ?? 'Failed to save account.');
      }
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded border border-border bg-panel/30 p-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-signal" />
        <p className="mt-4 text-sm text-text-secondary">Testing connection to your {provider.toUpperCase()} account...</p>
      </div>
    );
  }

  if (!result || !result.valid) {
    return (
      <div className="rounded border border-red-500/20 bg-panel/30 p-8 text-center">
        <XCircle className="mx-auto h-10 w-10 text-red-400" />
        <h3 className="mt-4 text-lg font-semibold text-red-400">Connection Failed</h3>
        <p className="mt-2 text-sm text-text-secondary">{result?.error ?? 'Unable to verify credentials.'}</p>
        <button
          onClick={onRetry}
          className="mt-6 rounded-lg border border-wire px-6 py-2.5 text-sm font-medium hover:bg-surface transition"
        >
          Update Credentials
        </button>
      </div>
    );
  }

  return (
    <div className="rounded border border-green-500/20 bg-panel/30 p-8 text-center">
      <CheckCircle className="mx-auto h-10 w-10 text-green-400" />
      <h3 className="mt-4 text-lg font-semibold text-green-400">Connection Verified</h3>
      {result.identity && (
        <p className="mt-2 text-sm font-mono text-text-secondary">{result.identity}</p>
      )}
      <p className="mt-2 text-sm text-text-dim">
        Your cloud account credentials are valid. Save to start scanning.
      </p>

      {saveError && (
        <div className="mx-auto mt-4 max-w-md rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {saveError}
        </div>
      )}

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={onRetry}
          className="rounded-lg border border-wire px-4 py-2 text-sm text-text-secondary hover:bg-surface transition"
        >
          Back
        </button>
        <button
          onClick={saveAndFinish}
          disabled={saving}
          className="rounded-lg bg-signal px-6 py-2.5 text-sm font-medium hover:bg-signal-hover transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save & Finish'}
        </button>
      </div>
    </div>
  );
}
