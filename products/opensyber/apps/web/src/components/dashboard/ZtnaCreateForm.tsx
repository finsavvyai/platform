'use client';

import { useState } from 'react';

interface Props {
  onCreated: () => void;
  onCancel: () => void;
}

export function ZtnaCreateForm({ onCreated, onCancel }: Props) {
  const [hostname, setHostname] = useState('');
  const [upstream, setUpstream] = useState('');
  const [requiredTrustScore, setRequiredTrustScore] = useState(70);
  const [forwardWriteMethods, setForwardWriteMethods] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/proxy/ztna/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname,
          upstream,
          requiredTrustScore,
          forwardWriteMethods,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(body.message ?? body.error ?? `Request failed (${res.status})`);
      }
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-zinc-800 bg-zinc-900/70 p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-white">Add gated app</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-xs text-zinc-400 block">
          Public hostname
          <input
            type="text"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="grafana.acme.com"
            required
            className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="text-xs text-zinc-400 block">
          Upstream URL
          <input
            type="url"
            value={upstream}
            onChange={(e) => setUpstream(e.target.value)}
            placeholder="https://internal-grafana.acme.local"
            required
            className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="text-xs text-zinc-400 block">
          Min trust score (30–100)
          <input
            type="number"
            min={30}
            max={100}
            step={1}
            value={requiredTrustScore}
            onChange={(e) => setRequiredTrustScore(parseInt(e.target.value, 10))}
            className="mt-1 w-full bg-zinc-950 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-100"
          />
        </label>
        <label className="text-xs text-zinc-400 flex items-center gap-2 mt-5">
          <input
            type="checkbox"
            checked={forwardWriteMethods}
            onChange={(e) => setForwardWriteMethods(e.target.checked)}
          />
          Forward POST/PUT/PATCH/DELETE
        </label>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-md bg-signal text-zinc-950 text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
