// BitbucketConnectionForm — auth entry for the Bitbucket Cloud bridge.
// Two modes: app password (user + appPassword) OR OAuth bearer token.
// License: Apache-2.0

import { useState } from 'react';
import type { ConnectPayload } from '../hooks/useBitbucketBridge';
import { btnGesturePrimary, btnGestureSubtle } from '../styles/gestures';

type Mode = 'app-password' | 'bearer';

interface Props {
  onSubmit: (body: ConnectPayload) => Promise<void>;
  submitting?: boolean;
  error?: string | null;
}

const inputCls =
  'w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-accent/50';

const labelCls = 'block text-xs text-zinc-400 mb-1';

export default function BitbucketConnectionForm({ onSubmit, submitting = false, error = null }: Props) {
  const [mode, setMode] = useState<Mode>('app-password');
  const [user, setUser] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [bearer, setBearer] = useState('');
  const [label, setLabel] = useState('');
  const [defaultWorkspace, setDefaultWorkspace] = useState('');

  const canSubmit =
    mode === 'app-password'
      ? user.trim().length > 0 && appPassword.trim().length > 0
      : bearer.trim().length > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    const payload: ConnectPayload = {
      label: label.trim() || undefined,
      defaultWorkspace: defaultWorkspace.trim() || undefined,
    };
    if (mode === 'app-password') {
      payload.user = user.trim();
      payload.appPassword = appPassword.trim();
    } else {
      payload.bearer = bearer.trim();
    }
    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-label="Connect Bitbucket">
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="inline-flex rounded-lg border border-surface-border bg-surface p-1"
      >
        {(['app-password', 'bearer'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${btnGestureSubtle} ${
              mode === m ? 'bg-accent/15 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {m === 'app-password' ? 'App password' : 'OAuth bearer'}
          </button>
        ))}
      </div>

      {mode === 'app-password' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="bb-user" className={labelCls}>Bitbucket username</label>
            <input id="bb-user" type="text" value={user} onChange={(e) => setUser(e.target.value)}
              placeholder="e.g. j.doe" className={inputCls} autoComplete="username" />
          </div>
          <div>
            <label htmlFor="bb-app-password" className={labelCls}>App password</label>
            <input id="bb-app-password" type="password" value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)} placeholder="ATBBxxxxx"
              className={inputCls} autoComplete="new-password" />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor="bb-bearer" className={labelCls}>OAuth bearer token</label>
          <input id="bb-bearer" type="password" value={bearer} onChange={(e) => setBearer(e.target.value)}
            placeholder="paste bearer token" className={inputCls} autoComplete="off" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="bb-label" className={labelCls}>Label (optional)</label>
          <input id="bb-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="Work account" className={inputCls} />
        </div>
        <div>
          <label htmlFor="bb-default-ws" className={labelCls}>Default workspace (optional)</label>
          <input id="bb-default-ws" type="text" value={defaultWorkspace}
            onChange={(e) => setDefaultWorkspace(e.target.value)}
            placeholder="my-team" className={inputCls} />
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <p className="text-xs text-zinc-500">
        Credentials are encrypted at rest. Bitbucket Server is not supported yet — this bridge targets Bitbucket Cloud only.
      </p>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className={`px-5 py-2 rounded-lg text-sm font-semibold bg-accent text-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed ${btnGesturePrimary}`}
      >
        {submitting ? 'Connecting…' : 'Connect Bitbucket'}
      </button>
    </form>
  );
}
