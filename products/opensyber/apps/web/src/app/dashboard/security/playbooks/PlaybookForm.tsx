'use client';

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { STEP_TYPES, TRIGGER_TYPES, triggerLabels, stepTypeLabels } from './types';
import type { PlaybookStep } from './types';

interface PlaybookFormProps {
  onClose: () => void;
}

export function PlaybookForm({ onClose }: PlaybookFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<string>('manual');
  const [steps, setSteps] = useState<PlaybookStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addStep(): void {
    setSteps([...steps, { type: STEP_TYPES[0], config: {} }]);
  }

  function removeStep(idx: number): void {
    setSteps(steps.filter((_, i) => i !== idx));
  }

  function updateStepType(idx: number, type: string): void {
    const updated = [...steps];
    updated[idx] = { type, config: {} };
    setSteps(updated);
  }

  function updateStepConfig(idx: number, raw: string): void {
    try {
      const config = JSON.parse(raw) as Record<string, unknown>;
      const updated = [...steps];
      updated[idx] = { ...updated[idx], config };
      setSteps(updated);
    } catch {
      // Invalid JSON, ignore until valid
    }
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/remediation/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, triggerType, steps }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed' }));
        throw new Error((body as { message: string }).message);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create playbook');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium">Create Playbook</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-signal"
              placeholder="e.g. Quarantine compromised agent" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-signal resize-none"
              placeholder="What does this playbook do?" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Trigger Type</label>
            <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}
              className="w-full rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-signal">
              {TRIGGER_TYPES.map((t) => (
                <option key={t} value={t}>{triggerLabels[t]}</option>
              ))}
            </select>
          </div>

          <StepsList steps={steps} onAdd={addStep} onRemove={removeStep}
            onTypeChange={updateStepType} onConfigChange={updateStepConfig} />

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:text-white transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="bg-info hover:bg-info disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium transition">
              {saving ? 'Creating...' : 'Create Playbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}

function StepsList({ steps, onAdd, onRemove, onTypeChange, onConfigChange }: {
  steps: PlaybookStep[]; onAdd: () => void; onRemove: (i: number) => void;
  onTypeChange: (i: number, t: string) => void; onConfigChange: (i: number, c: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium">Steps ({steps.length})</label>
        <button type="button" onClick={onAdd}
          className="inline-flex items-center gap-1 text-xs text-info hover:text-info transition">
          <Plus className="h-3 w-3" /> Add Step
        </button>
      </div>
      {steps.length === 0 && (
        <p className="text-xs text-neutral-500">No steps added yet.</p>
      )}
      <div className="space-y-3">
        {steps.map((step, i) => (
          <div key={i} className="rounded-lg bg-neutral-800/50 border border-neutral-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-neutral-400">Step {i + 1}</span>
              <button type="button" onClick={() => onRemove(i)} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <select value={step.type} onChange={(e) => onTypeChange(i, e.target.value)}
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-xs mb-2 focus:outline-none focus:ring-1 focus:ring-signal">
              {STEP_TYPES.map((t) => (
                <option key={t} value={t}>{stepTypeLabels[t]}</option>
              ))}
            </select>
            <textarea defaultValue={JSON.stringify(step.config, null, 2)} rows={2}
              onChange={(e) => onConfigChange(i, e.target.value)}
              className="w-full rounded-md bg-neutral-800 border border-neutral-700 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-signal resize-none"
              placeholder='{"key": "value"}' />
          </div>
        ))}
      </div>
    </div>
  );
}
