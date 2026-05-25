'use client';

import { CheckCircle, XCircle } from 'lucide-react';
import type { TestRun } from './detection-types';

interface DetectionResultsTableProps {
  run: TestRun;
  onBack: () => void;
}

/**
 * Renders test run results with pass/fail badges and latency values.
 */
export function DetectionResultsTable({ run, onBack }: DetectionResultsTableProps) {
  const avgLatency = run.tests.length > 0
    ? Math.round(run.tests.reduce((sum, t) => sum + (t.latencyMs ?? 0), 0) / run.tests.length)
    : 0;

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-zinc-400 hover:text-white transition-colors"
      >
        &larr; Back to suites
      </button>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Passed</p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            {run.passed}/{run.totalTests}
          </p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Failed</p>
          <p className="text-2xl font-bold text-red-400 mt-2">{run.failed}</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <p className="text-sm text-gray-400">Avg Latency</p>
          <p className="text-2xl font-bold text-white mt-2">{avgLatency}ms</p>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-zinc-700 text-zinc-400">
              <th className="py-3 px-4 font-medium">Test Name</th>
              <th className="py-3 px-4 font-medium">Technique</th>
              <th className="py-3 px-4 font-medium">Expected Detection</th>
              <th className="py-3 px-4 font-medium">Result</th>
              <th className="py-3 px-4 font-medium text-right">Latency</th>
            </tr>
          </thead>
          <tbody>
            {run.tests.map((test) => (
              <tr key={test.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="py-3 px-4 text-white font-medium">{test.name}</td>
                <td className="py-3 px-4">
                  <span className="font-mono text-xs text-zinc-400">{test.technique}</span>
                </td>
                <td className="py-3 px-4 text-zinc-300">{test.expectedDetection}</td>
                <td className="py-3 px-4">
                  {test.result === 'pass' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      Pass
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
                      <XCircle className="h-3 w-3" />
                      Fail
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-mono text-zinc-400">
                  {test.latencyMs != null ? `${test.latencyMs}ms` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
