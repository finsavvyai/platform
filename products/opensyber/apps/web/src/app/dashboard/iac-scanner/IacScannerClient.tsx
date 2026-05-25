'use client';

import { useState } from 'react';
import { FileCode, Upload } from 'lucide-react';
import { FRAMEWORK_CONFIG } from './types';
import type { IacScan, Framework } from './types';
import { ScanRow } from './ScanRow';

const FRAMEWORKS: (Framework | 'all')[] = ['all', 'terraform', 'cloudformation', 'kubernetes', 'dockerfile'];
const STATUSES: (IacScan['status'] | 'all')[] = ['all', 'passed', 'failed', 'warning'];

function countBySeverity(scan: IacScan, sev: string): number {
  return scan.findings.filter((f) => f.severity === sev).length;
}

export function IacScannerClient(): React.ReactElement {
  const [frameworkFilter, setFrameworkFilter] = useState<Framework | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<IacScan['status'] | 'all'>('all');
  const [expandedScan, setExpandedScan] = useState<string | null>(null);

  const scans: IacScan[] = [];

  const filtered = scans.filter((s) => {
    if (frameworkFilter !== 'all' && s.framework !== frameworkFilter) return false;
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  const totalScans = scans.length;
  const passRate = totalScans > 0 ? Math.round((scans.filter((s) => s.status === 'passed').length / totalScans) * 100) : 0;
  const criticalFindings = scans.reduce((sum, s) => sum + countBySeverity(s, 'critical'), 0);
  const totalLines = scans.reduce((sum, s) => sum + s.linesScanned, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <FileCode className="h-8 w-8 text-info" />
            IaC Scanner
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Shift-left security scanning for Infrastructure-as-Code templates.
          </p>
        </div>
        <button
          onClick={() => alert('Upload & Scan: coming soon')}
          className="flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium hover:bg-info transition"
        >
          <Upload className="h-4 w-4" /> Upload &amp; Scan
        </button>
      </div>

      {scans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
            <FileCode className="h-7 w-7 text-neutral-500" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">No IaC Scans Yet</h2>
          <p className="text-sm text-neutral-400 max-w-md">
            Connect your infrastructure to start seeing IaC scan results. Data will appear here automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Scans', value: totalScans, color: 'text-info' },
              { label: 'Pass Rate %', value: `${passRate}%`, color: 'text-green-400' },
              { label: 'Critical Findings', value: criticalFindings, color: 'text-red-400' },
              { label: 'Files Scanned', value: totalLines.toLocaleString(), color: 'text-amber-400' },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
                <p className="text-xs text-neutral-400">{c.label}</p>
                <p className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {FRAMEWORKS.map((fw) => (
                <button
                  key={fw}
                  onClick={() => setFrameworkFilter(fw)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    frameworkFilter === fw
                      ? 'bg-info text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {fw === 'all' ? 'All' : FRAMEWORK_CONFIG[fw].label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {STATUSES.map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                    statusFilter === st
                      ? 'bg-info text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-neutral-800 overflow-hidden">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0"><table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-900/50 border-b border-neutral-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase w-8" />
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">File</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Framework</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Findings</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Lines</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Scanned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-neutral-500">No scans match filters.</td></tr>
                ) : filtered.map((scan) => (
                  <ScanRow
                    key={scan.id}
                    scan={scan}
                    expanded={expandedScan === scan.id}
                    onToggle={() => setExpandedScan(expandedScan === scan.id ? null : scan.id)}
                  />
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}
    </div>
  );
}

