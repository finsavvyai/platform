'use client';

import { type ApiEndpoint, METHOD_COLORS } from './types';

interface Props {
  endpoints: ApiEndpoint[];
  onInvestigate: (id: string) => void;
}

function riskColor(score: number): string {
  if (score >= 70) return 'text-red-400';
  if (score >= 30) return 'text-amber-400';
  return 'text-green-400';
}

function riskBg(score: number): string {
  if (score >= 70) return 'bg-red-500';
  if (score >= 30) return 'bg-amber-500';
  return 'bg-green-500';
}

function Sparkline({ data }: { data: number[] }): React.ReactElement {
  const max = Math.max(...data, 1);
  const w = 70;
  const h = 20;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={w} height={h} className="inline-block">
      <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
    </svg>
  );
}

export function ApiInventoryTable({ endpoints, onInvestigate }: Props): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800">
        <h2 className="text-lg font-semibold">API Inventory</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-900/50 border-b border-neutral-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Method</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Path</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Risk</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Auth</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Last Called</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase">Volume</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {endpoints.map((ep) => (
              <tr key={ep.id} className="hover:bg-neutral-800/30 transition">
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${METHOD_COLORS[ep.method]}`}>
                    {ep.method}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-300">{ep.path}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 rounded-full bg-neutral-800 overflow-hidden">
                      <div className={`h-full rounded-full ${riskBg(ep.riskScore)}`} style={{ width: `${ep.riskScore}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${riskColor(ep.riskScore)}`}>{ep.riskScore}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-neutral-400 text-xs">{ep.authType}</td>
                <td className="px-4 py-3 text-neutral-500 text-xs">{new Date(ep.lastCalled).toLocaleTimeString()}</td>
                <td className="px-4 py-3"><Sparkline data={ep.requestVolume} /></td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onInvestigate(ep.id)} className="rounded px-2 py-1 text-xs text-info hover:bg-info/10 transition">
                    Investigate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
