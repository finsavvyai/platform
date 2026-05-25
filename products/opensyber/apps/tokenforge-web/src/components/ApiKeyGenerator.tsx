'use client';

import { useState } from 'react';
import { Copy, Check, KeyRound } from 'lucide-react';
import { useSession } from 'next-auth/react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://tokenforge-api.opensyber.cloud';

export function ApiKeyGenerator(): React.ReactElement {
  const { update } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/public/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError((json as { message?: string }).message ?? 'Failed');
        return;
      }
      const key = (json as { data: { apiKey: string } }).data.apiKey;
      setApiKey(key);
      await update({ apiKey: key });
    } catch {
      setError('Could not connect');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(): Promise<void> {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (apiKey) {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-6 text-center">
        <KeyRound className="h-8 w-8 text-green-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold mb-1">Your API Key</h3>
        <p className="text-sm text-amber-400 mb-4">Copy now — it won&apos;t be shown again.</p>
        <div className="flex items-center gap-2 rounded-lg bg-void p-3 mb-4 max-w-md mx-auto">
          <code className="flex-1 break-all font-mono text-xs text-green-400">{apiKey}</code>
          <button onClick={handleCopy} className="rounded p-1 text-text-secondary hover:text-text-primary">
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Replace <code className="bg-surface px-1 py-0.5 rounded text-xs">tf_your_api_key</code> in
          the script tag above with this key.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-panel p-6 text-center">
      <h3 className="text-lg font-semibold mb-2">Get your API key</h3>
      <p className="text-sm text-text-secondary mb-4">
        Free tier: 1,000 verifications/month. No credit card.
      </p>
      <form onSubmit={handleGenerate} className="max-w-sm mx-auto space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name or company"
          className="w-full rounded-lg border border-border bg-void px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full rounded-lg border border-border bg-void px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={!name.trim() || !email.trim() || loading}
          className="w-full rounded-lg bg-info px-4 py-2.5 text-sm font-medium hover:brightness-110 disabled:opacity-50 transition"
        >
          {loading ? 'Generating...' : 'Generate Free API Key'}
        </button>
      </form>
    </div>
  );
}
