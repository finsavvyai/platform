'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import { FRAMEWORK_CONFIG, SEVERITY_COLORS, STATUS_COLORS } from './types';
import type { IacScan } from './types';

function countBySeverity(scan: IacScan, sev: string): number {
  return scan.findings.filter((f) => f.severity === sev).length;
}

interface ScanRowProps {
  scan: IacScan;
  expanded: boolean;
  onToggle: () => void;
}

export function ScanRow({ scan, expanded, onToggle }: ScanRowProps): React.ReactElement {
  const fw = FRAMEWORK_CONFIG[scan.framework];
  const critical = countBySeverity(scan, 'critical');
  const high = countBySeverity(scan, 'high');
  const medium = countBySeverity(scan, 'medium');
  const low = countBySeverity(scan, 'low');

  return (
    <>
      <tr className="hover:bg-neutral-800/30 transition cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-neutral-400" /> : <ChevronRight className="h-4 w-4 text-neutral-400" />}
        </td>
        <td className="px-4 py-3 font-mono text-xs font-medium">{scan.fileName}</td>
        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs ${fw.color}`}>{fw.label}</span></td>
        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs capitalize ${STATUS_COLORS[scan.status]}`}>{scan.status}</span></td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            {critical > 0 && <span className={`px-1.5 py-0.5 rounded text-xs ${SEVERITY_COLORS.critical}`}>C:{critical}</span>}
            {high > 0 && <span className={`px-1.5 py-0.5 rounded text-xs ${SEVERITY_COLORS.high}`}>H:{high}</span>}
            {medium > 0 && <span className={`px-1.5 py-0.5 rounded text-xs ${SEVERITY_COLORS.medium}`}>M:{medium}</span>}
            {low > 0 && <span className={`px-1.5 py-0.5 rounded text-xs ${SEVERITY_COLORS.low}`}>L:{low}</span>}
            {scan.findings.length === 0 && <span className="text-xs text-neutral-500">None</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-neutral-400">{scan.linesScanned}</td>
        <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(scan.scannedAt).toLocaleString()}</td>
      </tr>
      {expanded && scan.findings.length > 0 && (
        <tr>
          <td colSpan={7} className="bg-neutral-900/50 px-6 py-4">
            <div className="space-y-3">
              {scan.findings.map((f) => (
                <div key={f.id} className="rounded-lg border border-neutral-800 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">{f.rule}: {f.description}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Resource: <span className="font-mono">{f.resource}</span> &middot; Line {f.line}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs shrink-0 capitalize ${SEVERITY_COLORS[f.severity]}`}>{f.severity}</span>
                  </div>
                  <div className="mt-3 rounded bg-neutral-800/60 px-3 py-2 text-xs text-neutral-300">
                    <span className="text-neutral-500">Remediation:</span> {f.remediation}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
