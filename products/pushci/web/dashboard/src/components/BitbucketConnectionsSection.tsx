// BitbucketConnectionsSection — renders the list of saved Bitbucket connections
// with a "New connection" inline form below. Extracted from the orchestrator
// page to keep every file under the 200-line cap.
// License: Apache-2.0

import BitbucketConnectionForm from './BitbucketConnectionForm';
import type { BitbucketConnection, ConnectPayload } from '../hooks/useBitbucketBridge';
import { btnGestureSubtle } from '../styles/gestures';

interface Props {
  connections: BitbucketConnection[];
  loading: boolean;
  activeConnId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => Promise<void> | void;
  onConnect: (body: ConnectPayload) => Promise<void>;
  connecting: boolean;
  error?: string | null;
}

export default function BitbucketConnectionsSection({
  connections, loading, activeConnId, onSelect, onDelete,
  onConnect, connecting, error,
}: Props) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface-card p-5" aria-label="Bitbucket connections">
      <h2 className="text-sm font-semibold text-zinc-100 mb-3">Connections</h2>

      {loading ? (
        <p className="text-xs text-zinc-500">Loading connections…</p>
      ) : connections.length === 0 ? (
        <p className="text-xs text-zinc-500 mb-4">No Bitbucket connections yet. Add one below.</p>
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
                    <div className="text-[11px] text-zinc-500 font-mono truncate">
                      {c.authType} · {c.secretPreview}
                    </div>
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

      <BitbucketConnectionForm onSubmit={onConnect} submitting={connecting} error={error} />
    </section>
  );
}
