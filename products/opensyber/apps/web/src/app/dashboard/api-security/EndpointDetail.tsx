'use client';

import { X } from 'lucide-react';
import { type ApiEndpoint, type ApiAttack, METHOD_COLORS } from './types';

interface Props {
  endpoint: ApiEndpoint;
  attacks: ApiAttack[];
  onClose: () => void;
}

export function EndpointDetail({ endpoint, attacks, onClose }: Props): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${METHOD_COLORS[endpoint.method]}`}>
            {endpoint.method}
          </span>
          <h2 className="text-lg font-semibold font-mono">{endpoint.path}</h2>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-neutral-800 transition" aria-label="Close">
          <X className="h-5 w-5 text-neutral-400" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-neutral-800 p-3">
          <p className="text-xs text-neutral-500">Risk Score</p>
          <p className="text-2xl font-bold text-red-400">{endpoint.riskScore}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 p-3">
          <p className="text-xs text-neutral-500">Auth Type</p>
          <p className="text-2xl font-bold text-neutral-300">{endpoint.authType}</p>
        </div>
        <div className="rounded-lg border border-neutral-800 p-3">
          <p className="text-xs text-neutral-500">Recent Attacks</p>
          <p className="text-2xl font-bold text-amber-400">{attacks.length}</p>
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-2">Recent Attack Attempts</h3>
      {attacks.length === 0 ? (
        <p className="text-neutral-500 text-sm py-4 text-center">No attacks recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800">
                <th className="px-3 py-2 text-left text-xs text-neutral-500 uppercase">Type</th>
                <th className="px-3 py-2 text-left text-xs text-neutral-500 uppercase">Source IP</th>
                <th className="px-3 py-2 text-left text-xs text-neutral-500 uppercase">Time</th>
                <th className="px-3 py-2 text-left text-xs text-neutral-500 uppercase">Blocked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {attacks.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-800/30 transition">
                  <td className="px-3 py-2 text-xs">{a.attackType}</td>
                  <td className="px-3 py-2 text-xs font-mono text-neutral-400">{a.sourceIp}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">{new Date(a.timestamp).toLocaleTimeString()}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${a.blocked ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {a.blocked ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="text-sm font-semibold mb-2 mt-6">Recommended Fixes</h3>
      <ul className="space-y-2 text-xs text-neutral-400">
        {endpoint.authType === 'None' && (
          <li className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            Add authentication to this endpoint. Public endpoints are vulnerable to abuse.
          </li>
        )}
        {endpoint.riskScore >= 70 && (
          <li className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            Enable rate limiting and add input validation to reduce risk score.
          </li>
        )}
        <li className="rounded-lg border border-info/20 bg-info/5 p-3">
          Add request body schema validation using Zod or similar.
        </li>
      </ul>
    </div>
  );
}
