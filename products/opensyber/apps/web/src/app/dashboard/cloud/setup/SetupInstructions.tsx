'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, Shield } from 'lucide-react';

type Provider = 'aws' | 'azure' | 'gcp';

interface SetupData {
  script: string;
  instructions: string[];
  requiredPermissions: string[];
}

interface Props {
  provider: Provider;
  onContinue: () => void;
}

const PROVIDER_NAMES: Record<Provider, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
};

export function SetupInstructions({ provider, onContinue }: Props) {
  const [data, setData] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });
    fetch(`/api/proxy/cloud/setup?provider=${provider}`)
      .then((r) => r.json())
      .then((d) => setData(d.data ?? d))
      .catch(() => setError('Failed to load setup instructions.'))
      .finally(() => setLoading(false));
  }, [provider]);

  async function copyScript() {
    if (!data) return;
    await navigator.clipboard.writeText(data.script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="rounded border border-border bg-panel/30 p-12 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-info" />
        <p className="mt-4 text-sm text-text-secondary">Loading {PROVIDER_NAMES[provider]} setup...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-400">{error ?? 'Failed to load instructions.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="rounded border border-border bg-panel/30 p-6">
        <h3 className="mb-4 text-lg font-semibold">Setup Steps</h3>
        <ol className="space-y-3">
          {data.instructions.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-text-primary">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-bold text-text-secondary">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Script block */}
      <div className="rounded border border-border bg-panel/30">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-xs font-medium text-text-secondary">
            {provider === 'aws' ? 'CloudFormation YAML' : 'CLI Script'}
          </span>
          <button onClick={copyScript} className="flex items-center gap-1.5 text-xs text-signal hover:text-signal-hover transition">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="max-h-80 overflow-auto p-4 text-xs leading-relaxed text-text-primary font-mono">
          {data.script}
        </pre>
      </div>

      {/* Required permissions */}
      <div className="rounded border border-border bg-panel/30 p-6">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold">Required Permissions</h3>
        </div>
        <ul className="space-y-1.5">
          {data.requiredPermissions.map((perm) => (
            <li key={perm} className="text-xs text-text-secondary">&bull; {perm}</li>
          ))}
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onContinue}
          className="rounded-lg bg-signal px-6 py-2.5 text-sm font-medium hover:bg-signal-hover transition"
        >
          I&apos;ve completed the setup &rarr;
        </button>
      </div>
    </div>
  );
}
