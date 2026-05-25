// GitHubActionsConnectionsSection — renders the list of saved GitHub
// Actions connections plus the PAT form. Extracted from the page to
// keep every file under the 200-line cap.
// License: Apache-2.0

import GitHubActionsConnectionForm from './GitHubActionsConnectionForm';
import type { GitHubActionsConnection, ConnectPayload } from '../hooks/useGitHubActionsBridge';
import { btnGestureSubtle } from '../styles/gestures';

interface Props {
  connections: GitHubActionsConnection[];
  loading: boolean;
  activeConnId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void> | void;
  onConnect: (body: ConnectPayload) => Promise<void>;
  connecting: boolean;
  error?: string | null;
}

export default function GitHubActionsConnectionsSection({
  connections, loading, activeConnId, onSelect, onDelete,
  onConnect, connecting, error,
}: Props) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5" aria-label="GitHub Actions connections">
      <h2 className="text-sm font-semibold text-zinc-100 mb-3">Connections</h2>

      {loading ? (
        <p className="text-xs text-zinc-500">Loading connections…</p>
      ) : connections.length === 0 ? (
        <p className="text-xs text-zinc-500 mb-4">No GitHub accounts connected yet. Add a personal access token below.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 mb-4">
          {connections.map((c) => {
            const active = c.id === activeConnId;
            return (
              <li key={c.id}
                className={`rounded-lg border p-3 ${active ? 'border-accent/40 bg-accent/5' : 'border-surface-border'}`}>
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-pressed={active}
                    className={`text-left min-w-0 flex-1 ${btnGestureSubtle}`}
                  >
                    <div className="text-sm text-zinc-100 truncate">{c.label}</div>
                    <div className="text-[11px] text-zinc-500 font-mono truncate">{c.tokenPreview}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => { void onDelete(c.id); }}
                    className="text-[11px] text-zinc-500 hover:text-red-400"
                    aria-label={`Remove ${c.label}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <GitHubActionsConnectionForm onSubmit={onConnect} submitting={connecting} error={error} />
    </section>
  );
}
