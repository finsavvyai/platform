'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface Soc2Control {
  oasfId: string;
  oasfName: string;
  tsc: string;
  tscName: string;
  status: string;
  summary: string;
}

interface Soc2Data {
  hasAssessment: boolean;
  readinessScore: number;
  passingControls: number;
  totalControls: number;
  assessmentDate?: string;
  controls: Soc2Control[];
}

export function Soc2Client() {
  const [data, setData] = useState<Soc2Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/proxy/soc2')
      .then((r) => r.json())
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-surface rounded w-1/3" />
          <div className="h-64 bg-surface rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">SOC2 Readiness</h1>
          <p className="text-sm text-text-secondary mt-1">Map your security posture to SOC2 Trust Service Criteria</p>
        </div>
        {data?.hasAssessment && (
          <span className="text-xs text-text-secondary shrink-0">
            Last assessed: {data.assessmentDate}
          </span>
        )}
      </div>

      {!data?.hasAssessment ? (
        <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
          <ShieldCheck className="w-12 h-12 mb-4" />
          <p className="text-lg">No OASF assessment found</p>
          <p className="text-sm">Run an OASF assessment first to see SOC2 readiness.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ScoreCard label="Readiness Score" value={`${data.readinessScore}%`}
              color={data.readinessScore >= 80 ? 'green' : data.readinessScore >= 50 ? 'amber' : 'red'} />
            <ScoreCard label="Passing Controls" value={`${data.passingControls}/${data.totalControls}`} color="blue" />
            <ScoreCard label="TSC Coverage" value={`${Math.round((data.passingControls / data.totalControls) * 100)}%`} color="blue" />
          </div>

          <div className="bg-panel/30 border border-border rounded overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-secondary">
                  <th className="p-4">OASF Control</th>
                  <th className="p-4">SOC2 TSC</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {data.controls.map((ctrl) => (
                  <tr key={ctrl.oasfId} className="hover:bg-panel/50">
                    <td className="p-4 text-sm font-medium">{ctrl.oasfId}: {ctrl.oasfName}</td>
                    <td className="p-4 text-sm text-text-secondary">{ctrl.tsc} — {ctrl.tscName}</td>
                    <td className="p-4">
                      <StatusBadge status={ctrl.status} />
                    </td>
                    <td className="p-4 text-sm text-text-secondary">{ctrl.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
}

function ScoreCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'text-green-500', amber: 'text-amber-500', red: 'text-red-500', blue: 'text-signal',
  };
  return (
    <div className="bg-panel/30 border border-border rounded p-8">
      <p className="text-xs text-text-secondary mb-2">{label}</p>
      <p className={`text-2xl font-semibold ${colors[color] ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'pass') return <span className="inline-flex items-center gap-1 text-green-500 text-xs"><CheckCircle className="w-3 h-3" />Pass</span>;
  if (status === 'fail') return <span className="inline-flex items-center gap-1 text-red-500 text-xs"><XCircle className="w-3 h-3" />Fail</span>;
  return <span className="inline-flex items-center gap-1 text-amber-500 text-xs"><AlertTriangle className="w-3 h-3" />Partial</span>;
}
