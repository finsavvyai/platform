import { Shield, Lock, Activity } from 'lucide-react';
import type { NetworkConnection } from './demo-constants';

interface NetworkTabProps {
  connections: NetworkConnection[];
}

export function NetworkTab({ connections }: NetworkTabProps): React.ReactElement {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">Network Connections</h2>
          <p className="text-sm text-text-dim mt-0.5">Real-time outbound traffic monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-text-secondary">Allowed</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-text-secondary">Blocked</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-text-dim border-b border-border">
              <th className="text-left py-2 pr-4 font-medium">Destination</th>
              <th className="text-left py-2 pr-4 font-medium">Protocol</th>
              <th className="text-left py-2 pr-4 font-medium">Status</th>
              <th className="text-left py-2 pr-4 font-medium">Technique</th>
              <th className="text-right py-2 font-medium">Bytes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {connections.map((c, i) => (
              <tr key={i} className="hover:bg-surface/30 transition-colors">
                <td className="py-2.5 pr-4 font-mono text-xs text-text-primary">{c.dest}</td>
                <td className="py-2.5 pr-4">
                  <span className="text-xs bg-surface px-2 py-0.5 rounded text-text-secondary">{c.proto}</span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className={`flex items-center gap-1.5 text-xs font-medium ${
                    c.status === 'allowed' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      c.status === 'allowed' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    {c.status === 'allowed' ? 'Allowed' : 'Blocked'}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-xs text-text-dim">{c.technique ?? '—'}</td>
                <td className="py-2.5 text-right text-xs text-text-secondary tabular-nums">{c.bytes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Firewall summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-surface/50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-4 w-4 text-green-400" />
            <span className="text-sm font-medium">Firewall Active</span>
          </div>
          <p className="text-xs text-text-dim">12 rules configured</p>
        </div>
        <div className="rounded-lg bg-surface/50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-red-400" />
            <span className="text-sm font-medium">5 Egress Blocked</span>
          </div>
          <p className="text-xs text-text-dim">C2 beacon, DNS tunnel, SNI lookalike, pastebin exfil, unknown domain</p>
        </div>
        <div className="rounded-lg bg-surface/50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium">68.4 KB Traffic</span>
          </div>
          <p className="text-xs text-text-dim">Total outbound today</p>
        </div>
      </div>
    </div>
  );
}
