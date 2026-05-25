'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const RULE_TYPES = [
  { value: 'file_pattern', label: 'File Pattern' },
  { value: 'command_pattern', label: 'Command Pattern' },
  { value: 'risk_threshold', label: 'Risk Threshold' },
  { value: 'secrets_threshold', label: 'Secrets Threshold' },
];

export function CreatePolicyModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [ruleType, setRuleType] = useState('file_pattern');
  const [pattern, setPattern] = useState('');
  const [threshold, setThreshold] = useState(80);
  const [severity, setSeverity] = useState('high');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPatternType = ruleType === 'file_pattern' || ruleType === 'command_pattern';
  const isValid = name.trim() && (!isPatternType || pattern.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Policy name is required.'); return; }
    if (isPatternType && !pattern.trim()) { setError('Pattern is required.'); return; }

    setSaving(true);
    setError(null);
    const ruleConfig = isPatternType ? { pattern } : { threshold };
    try {
      const res = await fetch('/api/proxy/agents/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, ruleType, ruleConfig, severity }),
      });
      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? 'Failed to create policy. Please try again.');
      }
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded border border-border bg-panel p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Policy</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-white transition" aria-label="Close dialog">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Policy Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Block .env access"
              className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Rule Type</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value)}
              className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm"
            >
              {RULE_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>
          {isPatternType ? (
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Pattern</label>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                required
                placeholder={ruleType === 'file_pattern' ? '**/.env*' : 'rm -rf *'}
                className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm font-mono"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Threshold</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                min={0}
                max={100}
                className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !isValid}
              className="rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
