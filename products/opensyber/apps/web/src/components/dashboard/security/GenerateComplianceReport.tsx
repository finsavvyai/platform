'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';

const FRAMEWORKS = [
  { value: 'soc2', label: 'SOC 2 Type II' },
  { value: 'iso27001', label: 'ISO 27001:2022' },
  { value: 'cis', label: 'CIS Controls v8' },
];

export function GenerateComplianceReport({ instanceId }: { instanceId: string }) {
  const [framework, setFramework] = useState('soc2');
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/compliance-reports`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ framework }),
        },
      );
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { message?: string }).message ?? 'Generation failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={framework}
        onChange={(e) => setFramework(e.target.value)}
        className="bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
      >
        {FRAMEWORKS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition disabled:opacity-50"
      >
        <FileText className="h-4 w-4" />
        {loading ? 'Generating...' : 'Generate Report'}
      </button>
    </div>
  );
}
