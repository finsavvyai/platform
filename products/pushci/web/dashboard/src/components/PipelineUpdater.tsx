import { useState } from 'react';
import { API_BASE_URL } from '../config';
import { useToast } from './Toast';

interface Change {
  type: 'add' | 'remove' | 'modify';
  description: string;
  suggestion: string;
}

interface Props {
  repo: string;
  changes: Change[];
  onApplied?: () => void;
  onDismiss?: () => void;
}

export default function PipelineUpdater({ repo, changes, onApplied, onDismiss }: Props) {
  const { toast } = useToast();
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || applied || changes.length === 0) return null;

  async function handleApply() {
    setApplying(true);
    try {
      const token = localStorage.getItem('pushci_token');
      const res = await fetch(`${API_BASE_URL}/api/pipeline/apply-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ repo, changes }),
      });
      if (!res.ok) throw new Error('Apply failed');
      setApplied(true);
      onApplied?.();
    } catch {
      toast({ type: 'error', title: 'Failed to apply pipeline update' });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-600/30 bg-amber-950/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-amber-400">
          Pipeline Update Available
        </h3>
        <button
          onClick={() => { setDismissed(true); onDismiss?.(); }}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          Dismiss
        </button>
      </div>
      <p className="text-xs text-zinc-400 mb-3">
        Your repo changed. The following updates are suggested for pushci.yml:
      </p>
      <ul className="space-y-1 mb-4">
        {changes.map((c, i) => (
          <li key={i} className="text-xs text-zinc-300 flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
              c.type === 'add' ? 'bg-emerald-900 text-emerald-300' :
              c.type === 'remove' ? 'bg-red-900 text-red-300' :
              'bg-blue-900 text-blue-300'
            }`}>
              {c.type}
            </span>
            {c.description}
          </li>
        ))}
      </ul>
      <button
        onClick={handleApply}
        disabled={applying}
        className="px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
      >
        {applying ? 'Applying...' : 'Apply Update'}
      </button>
    </div>
  );
}
