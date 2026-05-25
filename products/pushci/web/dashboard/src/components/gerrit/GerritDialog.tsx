import { useRef } from 'react';
import { btnGesturePrimary, btnGestureSubtle } from '../../styles/gestures';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import type { NewProjectForm } from './types';

interface Props {
  form: NewProjectForm;
  busy: boolean;
  onChange: (form: NewProjectForm) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const id = `gerrit-${props.label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs text-zinc-400">{props.label}</span>
      <input
        id={id}
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="mt-1 w-full rounded-lg border border-surface-border bg-surface-hover/40 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500/60 focus:outline-none"
      />
    </label>
  );
}

export default function GerritDialog({ form, busy, onChange, onSubmit, onClose }: Props) {
  const dialogRef = useRef<HTMLFormElement>(null);

  useFocusTrap(dialogRef, { onEscape: busy ? undefined : onClose });

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={() => !busy && onClose()}
    >
      <form
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gerrit-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-xl border border-surface-border bg-surface-card p-6 space-y-4"
      >
        <h2 id="gerrit-dialog-title" className="text-base font-semibold text-zinc-100">
          Add Gerrit project
        </h2>
        <Field label="Host" value={form.host} onChange={(v) => onChange({ ...form, host: v })} placeholder="https://gerrit.example.com" />
        <Field label="Project" value={form.project} onChange={(v) => onChange({ ...form, project: v })} placeholder="norlys/metering" />
        <Field label="HTTP user" value={form.httpUser} onChange={(v) => onChange({ ...form, httpUser: v })} placeholder="pushci-bot" />
        <Field label="HTTP password" type="password" value={form.httpPassword} onChange={(v) => onChange({ ...form, httpPassword: v })} placeholder="••••••••" />
        <Field label="Webhook secret" value={form.webhookSecret} onChange={(v) => onChange({ ...form, webhookSecret: v })} placeholder="shared secret" />

        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={form.pollEnabled}
            onChange={(e) => onChange({ ...form, pollEnabled: e.target.checked })}
            className="rounded border-surface-border"
          />
          Enable poll mode (for hosts without webhook support)
        </label>

        {form.pollEnabled && (
          <Field
            label="Poll interval sec"
            type="number"
            value={String(form.pollIntervalSec)}
            onChange={(v) => onChange({ ...form, pollIntervalSec: Number(v) || 300 })}
          />
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`flex-1 px-4 py-2 rounded-lg border border-surface-border bg-surface-hover/40 text-sm text-zinc-300 disabled:opacity-60 ${btnGestureSubtle}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className={`flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-900 text-sm font-semibold disabled:opacity-50 ${btnGesturePrimary}`}
          >
            {busy ? 'Saving…' : 'Register'}
          </button>
        </div>
      </form>
    </div>
  );
}
