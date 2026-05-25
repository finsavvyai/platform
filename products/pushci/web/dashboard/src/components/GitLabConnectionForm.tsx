// Connects a GitLab instance. Redacts the token preview so the raw
// PAT never renders in the DOM after submit.
import { useState } from 'react';
import { btnGesturePrimary } from '../styles/gestures';
import type { ConnectInput } from '../hooks/useGitLabBridge';

interface Props {
  busy?: boolean;
  error?: string | null;
  onSubmit: (input: ConnectInput) => Promise<void> | void;
}

function redactPreview(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) return trimmed ? '********' : '';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export default function GitLabConnectionForm({ busy, error, onSubmit }: Props) {
  const [baseUrl, setBaseUrl] = useState('https://gitlab.com');
  const [label, setLabel] = useState('');
  const [privateToken, setPrivateToken] = useState('');
  const [reveal, setReveal] = useState(false);

  const canSubmit = privateToken.trim().length >= 8 && baseUrl.trim().length > 0 && !busy;

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    await onSubmit({
      baseUrl: baseUrl.trim(),
      label: label.trim() || undefined,
      privateToken: privateToken.trim(),
    });
  };

  return (
    <form
      onSubmit={handle}
      aria-label="Connect GitLab instance"
      className="rounded-xl border border-surface-border bg-surface-card p-5 space-y-4 max-w-xl"
    >
      <header>
        <h3 className="text-sm font-semibold text-zinc-100">Connect a GitLab instance</h3>
        <p className="text-xs text-zinc-500 mt-1">
          Personal access tokens are stored encrypted; only a redacted preview is returned.
        </p>
      </header>

      <div>
        <label htmlFor="gitlab-base-url" className="block text-xs text-zinc-400 mb-1">Base URL</label>
        <input
          id="gitlab-base-url"
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://gitlab.com"
          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        />
      </div>

      <div>
        <label htmlFor="gitlab-label" className="block text-xs text-zinc-400 mb-1">Label (optional)</label>
        <input
          id="gitlab-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="gitlab.acme.eu"
          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-accent/50"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="gitlab-token" className="block text-xs text-zinc-400">Personal access token</label>
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
            aria-pressed={reveal}
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>
        <input
          id="gitlab-token"
          type={reveal ? 'text' : 'password'}
          value={privateToken}
          onChange={(e) => setPrivateToken(e.target.value)}
          placeholder="glpat-XXXXXXXXXXXXXXXXXXXX"
          autoComplete="off"
          className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm font-mono text-zinc-200 focus:outline-none focus:border-accent/50"
        />
        <div className="mt-1 text-xs text-zinc-500 font-mono" aria-live="polite">
          Preview: <span data-testid="token-preview">{redactPreview(privateToken) || '—'}</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className={`px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${btnGesturePrimary}`}
      >
        {busy ? 'Connecting…' : 'Connect'}
      </button>
    </form>
  );
}
