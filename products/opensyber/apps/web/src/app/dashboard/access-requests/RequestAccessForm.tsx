'use client';

import { useState } from 'react';
import { Plus, X, Send } from 'lucide-react';
import { resourceOptions, durationOptions, levelOptions } from './types';
import type { AccessLevel } from './types';

const inputClass =
  'w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-signal';
const labelClass = 'block text-sm font-medium text-neutral-300 mb-1';

export function RequestAccessForm(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [resource, setResource] = useState('');
  const [level, setLevel] = useState<AccessLevel>('read-only');
  const [duration, setDuration] = useState('1 hour');
  const [justification, setJustification] = useState('');
  const [ticketRef, setTicketRef] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (): void => {
    if (!resource || !justification.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setResource('');
      setLevel('read-only');
      setDuration('1 hour');
      setJustification('');
      setTicketRef('');
    }, 1500);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mb-6 flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:bg-info transition"
      >
        <Plus className="h-4 w-4" /> Request Access
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Request Elevated Access</h3>
        <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-neutral-800 transition" aria-label="Close form">
          <X className="h-4 w-4 text-neutral-400" />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className={labelClass}>Target Resource</label>
          <select value={resource} onChange={(e) => setResource(e.target.value)} className={inputClass} aria-label="Target resource">
            <option value="">Select resource...</option>
            {resourceOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Access Level</label>
          <select value={level} onChange={(e) => setLevel(e.target.value as AccessLevel)} className={inputClass} aria-label="Access level">
            {levelOptions.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Duration</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value)} className={inputClass} aria-label="Duration">
            {durationOptions.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Ticket Reference (optional)</label>
          <input type="text" value={ticketRef} onChange={(e) => setTicketRef(e.target.value)} placeholder="e.g. INC-1234" className={inputClass} />
        </div>
      </div>
      <div className="mb-4">
        <label className={labelClass}>Justification (required)</label>
        <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} className={inputClass} placeholder="Why do you need this access?" />
      </div>
      <button
        onClick={handleSubmit}
        disabled={!resource || !justification.trim() || submitted}
        className="flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:bg-info disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        <Send className="h-4 w-4" />
        {submitted ? 'Submitted!' : 'Submit Request'}
      </button>
    </div>
  );
}
