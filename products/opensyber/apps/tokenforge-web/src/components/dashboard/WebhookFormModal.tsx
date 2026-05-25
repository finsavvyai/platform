'use client';

import { Copy, Check } from 'lucide-react';

export const SUPPORTED_EVENTS = [
  'session.bound',
  'session.verified',
  'session.revoked',
  'trust_score.degraded',
  'trust_score.critical',
  'session.hijack_attempt',
] as const;

interface WebhookFormModalProps {
  open: boolean;
  formName: string;
  formUrl: string;
  formEvents: string[];
  formError: string;
  creating: boolean;
  revealedSecret: string | null;
  copied: boolean;
  onNameChange: (v: string) => void;
  onUrlChange: (v: string) => void;
  onToggleEvent: (ev: string) => void;
  onCancel: () => void;
  onCreate: () => void;
  onCopy: () => void;
}

export function WebhookFormModal(props: WebhookFormModalProps): React.ReactElement | null {
  const {
    open, formName, formUrl, formEvents, formError, creating, revealedSecret, copied,
    onNameChange, onUrlChange, onToggleEvent, onCancel, onCreate, onCopy,
  } = props;

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add webhook"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-panel p-6">
        <h3 className="mb-4 text-lg font-semibold">
          {revealedSecret ? 'Webhook Secret' : 'Add Webhook'}
        </h3>
        {!revealedSecret ? (
          <>
            <label htmlFor="wh-name" className="mb-1 block text-sm text-text-secondary">
              Name (optional)
            </label>
            <input
              id="wh-name"
              type="text"
              value={formName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., Production"
              className="mb-3 w-full rounded-lg border border-border bg-void px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
            />
            <label htmlFor="wh-url" className="mb-1 block text-sm text-text-secondary">
              Endpoint URL
            </label>
            <input
              id="wh-url"
              type="url"
              value={formUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://api.example.com/webhooks/tokenforge"
              className="mb-3 w-full rounded-lg border border-border bg-void px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
            />
            <p className="mb-2 text-sm text-text-secondary">Events</p>
            <div className="mb-4 grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-border bg-void p-2">
              {SUPPORTED_EVENTS.map((ev) => (
                <label
                  key={ev}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface/50"
                >
                  <input
                    type="checkbox"
                    checked={formEvents.includes(ev)}
                    onChange={() => onToggleEvent(ev)}
                    className="h-4 w-4"
                  />
                  <code className="text-xs text-text-primary">{ev}</code>
                </label>
              ))}
            </div>
            {formError && (
              <p className="mb-3 text-sm text-alert" role="alert">
                {formError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg border border-wire px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition"
              >
                Cancel
              </button>
              <button
                onClick={onCreate}
                disabled={creating}
                className="flex-1 rounded-lg bg-info px-4 py-2 text-sm font-medium text-void hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {creating ? 'Saving...' : 'Save Webhook'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-warn">
              Copy this signing secret now. It will not be shown again.
            </p>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-void p-3">
              <code className="flex-1 break-all font-mono text-xs text-ok">
                {revealedSecret}
              </code>
              <button
                onClick={onCopy}
                className="rounded p-1 text-text-secondary hover:text-text-primary transition"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-ok" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <button
              onClick={onCancel}
              className="w-full rounded-lg bg-info px-4 py-2 text-sm font-medium text-void hover:brightness-110 transition"
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
