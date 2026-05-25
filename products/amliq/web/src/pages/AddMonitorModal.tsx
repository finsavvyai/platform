import { useState } from 'react';
interface Props { onClose: () => void; onAdd?: (p: { name: string; riskLevel: string; frequency: string }) => void; onCreated?: () => void; onUpdate?: () => void }
export default function AddMonitorModal({ onClose, onAdd, onCreated }: Props) {
  const [name, setName] = useState('');
  const [risk, setRisk] = useState('medium');
  const [freq, setFreq] = useState('daily');
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="rounded-xl p-6 w-full max-w-md" style={{ background: 'var(--dash-bg-secondary)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--dash-border)' }} onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--dash-text)' }}>Add to Monitoring</h2>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Entity name"
          className="w-full rounded px-3 py-2 text-sm mb-3" style={{ background: 'var(--dash-bg-tertiary)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }} />
        <select value={risk} onChange={e => setRisk(e.target.value)}
          className="w-full rounded px-3 py-2 text-sm mb-3" style={{ background: 'var(--dash-bg-tertiary)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}>
          <option value="low">Low Risk</option><option value="medium">Medium Risk</option>
          <option value="high">High Risk</option><option value="critical">Critical</option>
        </select>
        <select value={freq} onChange={e => setFreq(e.target.value)}
          className="w-full rounded px-3 py-2 text-sm mb-3" style={{ background: 'var(--dash-bg-tertiary)', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--dash-border)', color: 'var(--dash-text)' }}>
          <option value="realtime">Real-time</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
        </select>
        <div className="flex gap-3 mt-4">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded text-sm" style={{ borderColor: 'var(--dash-border)', color: 'var(--dash-text-secondary)' }}>Cancel</button>
          <button type="button" onClick={() => { if (name) { onAdd?.({ name, riskLevel: risk, frequency: freq }); onCreated?.(); } }}
            style={{ background: '#1A1814', color: '#FAFAF8' }} className="flex-1 px-4 py-2 rounded text-sm">Add</button>
        </div>
      </div>
    </div>
  );
}
