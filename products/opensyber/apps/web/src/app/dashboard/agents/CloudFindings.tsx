'use client';

import { useEffect, useState } from 'react';
import { Cloud, AlertTriangle, ExternalLink } from 'lucide-react';

interface Finding {
  id: string;
  checkId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  resourceId: string;
  resourceType: string;
  region: string;
  status: string;
}

const severityBadge: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-orange-500/10 text-orange-400',
};

/**
 * Shows critical/high CSPM findings on the Agent Activity page.
 * Framing: "Your AI agent can reach these misconfigured cloud resources."
 */
export function CloudFindings() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/proxy/cloud/findings?severity=critical,high&status=open&limit=5')
      .then((r) => r.json())
      .then((d) => setFindings(d.data ?? []))
      .catch(() => setFindings([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || findings.length === 0) return null;

  return (
    <div className="mt-6 rounded border border-orange-500/20 bg-orange-500/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-orange-400" />
          <h3 className="text-sm font-semibold">Cloud Exposure</h3>
          <span className="text-xs text-text-dim">
            Resources your agent can reach
          </span>
        </div>
        <a href="/dashboard/cloud/findings"
          className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300">
          View all <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="space-y-2">
        {findings.map((f) => (
          <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border bg-panel/50 p-3">
            <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{f.title}</p>
              <p className="text-xs text-text-dim truncate">
                {f.resourceType} &middot; {f.resourceId} &middot; {f.region}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${severityBadge[f.severity] ?? ''}`}>
              {f.severity}
            </span>
          </div>
        ))}
      </div>

      {findings.length >= 5 && (
        <p className="mt-3 text-xs text-text-dim text-center">
          Showing top 5 findings.{' '}
          <a href="/dashboard/cloud/findings" className="text-orange-400 hover:underline">
            See all cloud findings
          </a>
        </p>
      )}
    </div>
  );
}
