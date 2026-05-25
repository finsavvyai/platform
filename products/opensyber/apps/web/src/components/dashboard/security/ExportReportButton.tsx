'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

interface ExportReportButtonProps {
  instanceId: string;
  reportId: string;
}

export function ExportReportButton({ instanceId, reportId }: ExportReportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/compliance-reports/${reportId}/export?format=csv`,
      );
      if (!res.ok) throw new Error('Export failed');
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank');
    } catch {
      // Show inline error could be added
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-neutral-700 disabled:opacity-50 transition"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      Export CSV
    </button>
  );
}
