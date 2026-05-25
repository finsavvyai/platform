'use client';

import { useState } from 'react';
import { Copy, Check, Plus } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

interface Props {
  token: string | null;
  onSaved: () => void;
}

export function AddDomainForm({ token, onSaved }: Props): React.ReactElement {
  const [hostname, setHostname] = useState('');
  const [origin, setOrigin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dnsProviders, setDnsProviders] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    if (!hostname.trim() || !origin.trim() || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (!token) return;
      const res = await fetch(`${API_BASE}/v1/proxy/config`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hostname: hostname.trim(), origin: origin.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError((json as { message?: string }).message ?? 'Failed to save');
        return;
      }
      const result = (json as { data: { dns?: { cname: string; providers: { name: string; instructions: string }[] } } }).data;
      const dnsInfo = result.dns;
      const providerList = dnsInfo?.providers?.map((p: { name: string; instructions: string }) => `${p.name}: ${p.instructions}`).join('\n') ?? '';
      setSuccess(`Configured! Add this DNS record:\n${dnsInfo?.cname ?? `${hostname} CNAME tokenforge-proxy.broad-dew-49ad.workers.dev`}`);
      setDnsProviders(providerList);
      setHostname('');
      setOrigin('');
      onSaved();
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleCopy(text: string): void {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-8 rounded-2xl border border-border/50 bg-panel p-6">
      <h2 className="mb-4 text-lg font-semibold">Add Domain</h2>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-text-secondary">
            Your domain <span className="text-text-muted">(what users visit)</span>
          </label>
          <input
            type="text"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="app.yoursite.com"
            className="w-full rounded-lg border border-border/50 bg-void px-3 py-2 text-sm text-white placeholder:text-text-muted focus:border-info focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-secondary">
            Your server URL <span className="text-text-muted">(where your app actually runs)</span>
          </label>
          <input
            type="text"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="https://my-app.vercel.app or https://api.yoursite.com"
            className="w-full rounded-lg border border-border/50 bg-void px-3 py-2 text-sm text-white placeholder:text-text-muted focus:border-info focus:outline-none"
          />
          <p className="mt-1 text-xs text-text-muted">
            TokenForge sits between users and this server. Same URL = same domain, different URL = app hosted elsewhere (Vercel, AWS, etc.)
          </p>
        </div>
        {error && <p className="text-sm text-alert">{error}</p>}
        {success && (
          <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3">
            <p className="text-sm text-green-400 whitespace-pre-line">{success}</p>
            <button
              onClick={() => handleCopy('tokenforge-proxy.broad-dew-49ad.workers.dev')}
              className="mt-2 flex items-center gap-1 text-xs text-green-300 hover:text-green-200"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              Copy CNAME target
            </button>
            {dnsProviders && (
              <details className="mt-3">
                <summary className="text-xs text-text-secondary cursor-pointer hover:text-text-secondary">
                  Provider-specific instructions
                </summary>
                <pre className="mt-2 text-xs text-text-muted whitespace-pre-line">{dnsProviders}</pre>
              </details>
            )}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={!hostname.trim() || !origin.trim() || saving}
          className="flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50 transition"
        >
          <Plus className="h-4 w-4" />
          {saving ? 'Saving...' : 'Add Domain'}
        </button>
      </div>
    </div>
  );
}
