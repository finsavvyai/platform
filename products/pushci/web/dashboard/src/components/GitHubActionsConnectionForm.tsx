// GitHubActionsConnectionForm — PAT entry for the GitHub Actions bridge.
// Explains required scopes inline; previews token as `ghp_…abcd`.
// License: Apache-2.0

import { useMemo, useState } from 'react';
import type { ConnectPayload } from '../hooks/useGitHubActionsBridge';
import { btnGesturePrimary } from '../styles/gestures';

interface Props {
  onSubmit: (body: ConnectPayload) => Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

const inputCls =
  'w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent/50 font-mono';
const labelCls = 'block text-xs text-zinc-400 mb-1';

export function redactToken(tok: string): string {
  const t = tok.trim();
  if (t.length === 0) return '';
  const prefixMatch = t.match(/^(gh[pousr]_)/i);
  const prefix = prefixMatch ? prefixMatch[1] : t.slice(0, 4);
  const tail = t.length >= 4 ? t.slice(-4) : '';
  return `${prefix}…${tail}`;
}

export default function GitHubActionsConnectionForm({ onSubmit, submitting = false, error = null }: Props) {
  const [token, setToken] = useState('');
  const [label, setLabel] = useState('');
  const trimmed = token.trim();
  const canSubmit = trimmed.length >= 20 && !submitting;
  const preview = useMemo(() => redactToken(trimmed), [trimmed]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    await onSubmit({ token: trimmed, label: label.trim() || undefined });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Connect GitHub Actions">
      <div>
        <label htmlFor="gha-token" className={labelCls}>Personal access token</label>
        <input
          id="gha-token" type="password" value={token} onChange={(e) => setToken(e.target.value)}
          placeholder="ghp_••••••••••••••••••••••••••••••" className={inputCls}
          autoComplete="off" spellCheck={false}
        />
        {preview && (
          <p className="mt-1 text-[11px] text-zinc-500 font-mono" aria-label="Token preview">
            preview: <span className="text-zinc-300">{preview}</span>
          </p>
        )}
      </div>

      <div>
        <label htmlFor="gha-label" className={labelCls}>Label (optional)</label>
        <input
          id="gha-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)}
          placeholder="Work account"
          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent/50"
        />
      </div>

      <details className="rounded-lg border border-surface-border bg-surface/60 p-3 text-xs text-zinc-400">
        <summary className="cursor-pointer text-zinc-300">Required token scopes</summary>
        <ul className="mt-2 space-y-1 pl-4 list-disc">
          <li><code className="text-emerald-400">repo</code> — read private repository metadata</li>
          <li><code className="text-emerald-400">workflow</code> — list workflows and dispatch runs</li>
          <li><code className="text-emerald-400">actions:read</code> — fetch runs, jobs, and step statuses</li>
        </ul>
        <p className="mt-2">
          Fine-grained tokens also work if they grant <code>Actions</code> read/write on the repositories you want to import.
        </p>
      </details>

      {error && (
        <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <p className="text-xs text-zinc-500">
        The token is encrypted at rest and never leaves your PushCI tenant. Only the redacted preview is ever displayed.
      </p>

      <button
        type="submit"
        disabled={!canSubmit}
        className={`px-5 py-2 rounded-lg text-sm font-semibold bg-accent text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${btnGesturePrimary}`}
      >
        {submitting ? 'Connecting…' : 'Connect GitHub Actions'}
      </button>
    </form>
  );
}
