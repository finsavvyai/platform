import { useRef } from 'react';
import { btnGesturePrimary, btnGestureSubtle } from '../../styles/gestures';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  AUTH_MODES,
  type AuthMode,
  type RegistryDraft,
  type RegistryType,
  TYPES,
  needsRegion,
} from './types';

const inputCls =
  'w-full px-3 py-2 text-sm bg-surface-hover/50 border border-surface-border rounded-lg text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40';
const labelCls = 'text-xs text-zinc-400 mb-1 block';

interface Props {
  editing: boolean;
  draft: RegistryDraft;
  formError: string | null;
  submitting: boolean;
  onDraftChange: (draft: RegistryDraft) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function RegistryDialog({
  editing, draft, formError, submitting,
  onDraftChange, onSubmit, onClose,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap(dialogRef, { onEscape: submitting ? undefined : onClose });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => !submitting && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="registry-dialog-title"
        className="w-full max-w-lg bg-surface-card border border-surface-border rounded-xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="registry-dialog-title" className="text-lg font-semibold text-zinc-100 mb-4">
          {editing ? 'Edit registry' : 'New registry'}
        </h2>

        <div className="space-y-3">
          <div>
            <label htmlFor="reg-name" className={labelCls}>Name</label>
            <input
              id="reg-name"
              value={draft.name}
              onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
              className={inputCls}
              placeholder="norlys-artifactory"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-type" className={labelCls}>Type</label>
              <select
                id="reg-type"
                value={draft.type}
                onChange={(e) => onDraftChange({ ...draft, type: e.target.value as RegistryType })}
                className={inputCls}
              >
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="reg-auth" className={labelCls}>Auth mode</label>
              <select
                id="reg-auth"
                value={draft.authMode}
                onChange={(e) => onDraftChange({ ...draft, authMode: e.target.value as AuthMode })}
                className={inputCls}
              >
                {AUTH_MODES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="reg-url" className={labelCls}>URL</label>
            <input
              id="reg-url"
              value={draft.url}
              onChange={(e) => onDraftChange({ ...draft, url: e.target.value })}
              className={inputCls}
              placeholder="https://artifactory.corp.com/repo"
            />
          </div>
          {needsRegion(draft.type) && (
            <div>
              <label htmlFor="reg-region" className={labelCls}>Region</label>
              <input
                id="reg-region"
                value={draft.region ?? ''}
                onChange={(e) => onDraftChange({ ...draft, region: e.target.value })}
                className={inputCls}
                placeholder="eu-west-1"
              />
            </div>
          )}
          {draft.authMode === 'basic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-user" className={labelCls}>Username secret ref</label>
                <input
                  id="reg-user"
                  value={draft.usernameRef ?? ''}
                  onChange={(e) => onDraftChange({ ...draft, usernameRef: e.target.value })}
                  className={inputCls}
                  placeholder="projects/x/secrets/user"
                />
              </div>
              <div>
                <label htmlFor="reg-pass" className={labelCls}>Password secret ref</label>
                <input
                  id="reg-pass"
                  value={draft.passwordRef ?? ''}
                  onChange={(e) => onDraftChange({ ...draft, passwordRef: e.target.value })}
                  className={inputCls}
                  placeholder="projects/x/secrets/pw"
                />
              </div>
            </div>
          )}
          {draft.authMode === 'bearer' && (
            <div>
              <label htmlFor="reg-token" className={labelCls}>Token secret ref</label>
              <input
                id="reg-token"
                value={draft.tokenRef ?? ''}
                onChange={(e) => onDraftChange({ ...draft, tokenRef: e.target.value })}
                className={inputCls}
                placeholder="projects/x/secrets/token"
              />
            </div>
          )}
        </div>

        {formError && (
          <div role="alert" className="mt-3 text-xs text-rose-300">{formError}</div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={`px-4 py-2 text-sm rounded-lg bg-surface-hover border border-surface-border text-zinc-200 disabled:opacity-60 ${btnGestureSubtle}`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            aria-busy={submitting}
            className={`px-4 py-2 text-sm rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 disabled:opacity-60 ${btnGesturePrimary}`}
          >
            {submitting ? 'Saving…' : editing ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
