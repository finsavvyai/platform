'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { RuleCondition, RuleAction } from './builder-types';
import {
  EVENT_TYPE_OPTIONS,
  OPERATOR_OPTIONS,
  ACTION_OPTIONS,
  CHANNEL_OPTIONS,
} from './builder-types';

interface RuleComposerProps {
  onSave: (rule: { name: string; conditions: RuleCondition[]; actions: RuleAction[] }) => void;
  onClose: () => void;
  saving: boolean;
}

function emptyCondition(): RuleCondition {
  return { field: 'eventType', operator: 'equals', value: '' };
}

function emptyAction(): RuleAction {
  return { type: 'alert', config: { severity: 'medium' } };
}

export function RuleComposer({ onSave, onClose, saving }: RuleComposerProps) {
  const [name, setName] = useState('');
  const [conditions, setConditions] = useState<RuleCondition[]>([emptyCondition()]);
  const [actions, setActions] = useState<RuleAction[]>([emptyAction()]);

  function updateCondition(idx: number, patch: Partial<RuleCondition>) {
    setConditions((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  function removeCondition(idx: number) {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateAction(idx: number, patch: Partial<RuleAction>) {
    setActions((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, ...patch, config: { ...a.config, ...(patch.config ?? {}) } } : a)),
    );
  }

  function removeAction(idx: number) {
    if (actions.length <= 1) return;
    setActions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), conditions, actions });
  }

  const selectClass =
    'rounded-lg border border-wire bg-surface px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-signal';
  const inputClass =
    'rounded-lg border border-wire bg-surface px-3 py-1.5 text-sm text-neutral-200 placeholder:text-text-dim focus:outline-none focus:ring-1 focus:ring-signal';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded border border-border bg-panel p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-neutral-100">Create Custom Rule</h2>
          <button onClick={onClose} className="text-text-dim hover:text-text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-text-secondary mb-1">Rule Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Block suspicious AI queries"
            className={`${inputClass} w-full`}
          />
        </div>

        <ConditionSection
          conditions={conditions}
          onUpdate={updateCondition}
          onRemove={removeCondition}
          onAdd={() => setConditions((p) => [...p, emptyCondition()])}
          selectClass={selectClass}
          inputClass={inputClass}
        />

        <ActionSection
          actions={actions}
          onUpdate={updateAction}
          onRemove={removeAction}
          onAdd={() => setActions((p) => [...p, emptyAction()])}
          selectClass={selectClass}
        />

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button onClick={onClose} className="rounded-lg border border-wire px-4 py-2 text-sm text-text-secondary hover:bg-surface transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : 'Save Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConditionSection({ conditions, onUpdate, onRemove, onAdd, selectClass, inputClass }: {
  conditions: RuleCondition[]; onUpdate: (i: number, p: Partial<RuleCondition>) => void;
  onRemove: (i: number) => void; onAdd: () => void; selectClass: string; inputClass: string;
}) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-medium text-text-secondary mb-2">IF conditions</label>
      <div className="space-y-2">
        {conditions.map((cond, idx) => (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            {idx > 0 && <span className="text-xs font-medium text-amber-400">AND</span>}
            <select value={cond.field} onChange={(e) => onUpdate(idx, { field: e.target.value })} className={selectClass}>
              {EVENT_TYPE_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
              <option value="source">source</option>
              <option value="count">count</option>
              <option value="threshold">threshold</option>
              <option value="path">path</option>
              <option value="checkId">checkId</option>
              <option value="bytesOut">bytesOut</option>
            </select>
            <select value={cond.operator} onChange={(e) => onUpdate(idx, { operator: e.target.value as RuleCondition['operator'] })} className={selectClass}>
              {OPERATOR_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
            <input
              value={String(cond.value)}
              onChange={(e) => onUpdate(idx, { value: e.target.value })}
              placeholder="value"
              className={`${inputClass} flex-1 min-w-[120px]`}
            />
            <button onClick={() => onRemove(idx)} disabled={conditions.length <= 1} className="text-text-dim hover:text-red-400 disabled:opacity-30">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={onAdd} className="mt-2 flex items-center gap-1 text-xs text-signal hover:text-signal-hover">
        <Plus className="h-3 w-3" /> Add condition
      </button>
    </div>
  );
}

function ActionSection({ actions, onUpdate, onRemove, onAdd, selectClass }: {
  actions: RuleAction[]; onUpdate: (i: number, p: Partial<RuleAction>) => void;
  onRemove: (i: number) => void; onAdd: () => void; selectClass: string;
}) {
  return (
    <div className="mb-2">
      <label className="block text-xs font-medium text-text-secondary mb-2">THEN actions</label>
      <div className="space-y-2">
        {actions.map((action, idx) => (
          <div key={idx} className="flex items-center gap-2 flex-wrap">
            <select value={action.type} onChange={(e) => onUpdate(idx, { type: e.target.value as RuleAction['type'] })} className={selectClass}>
              {ACTION_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
            {action.type === 'alert' && (
              <select value={action.config.severity ?? 'medium'} onChange={(e) => onUpdate(idx, { config: { severity: e.target.value as RuleAction['config']['severity'] } })} className={selectClass}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            )}
            {action.type === 'notify' && (
              <select value={action.config.channel ?? 'email'} onChange={(e) => onUpdate(idx, { config: { channel: e.target.value } })} className={selectClass}>
                {CHANNEL_OPTIONS.map((ch) => (<option key={ch} value={ch}>{ch}</option>))}
              </select>
            )}
            <button onClick={() => onRemove(idx)} disabled={actions.length <= 1} className="text-text-dim hover:text-red-400 disabled:opacity-30">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={onAdd} className="mt-2 flex items-center gap-1 text-xs text-signal hover:text-signal-hover">
        <Plus className="h-3 w-3" /> Add action
      </button>
    </div>
  );
}
