'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface ExportAuditButtonProps {
  instanceId: string;
}

export function ExportAuditButton({ instanceId }: ExportAuditButtonProps) {
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const handleExport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ format: 'csv' });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/audit/export?${params}`,
      );
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank');
    } catch {
      // Could display error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs text-text-primary focus:border-signal focus:outline-none"
        placeholder="From"
      />
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs text-text-primary focus:border-signal focus:outline-none"
        placeholder="To"
      />
      <button
        onClick={handleExport}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-neutral-700 disabled:opacity-50 transition"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Export Audit CSV
      </button>
    </div>
  );
}
