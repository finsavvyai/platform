'use client';

import type { Identity } from './types';
import { calcGap } from './types';
import { IdentityTypeBadge, RiskBadge } from './EntitlementBadges';

interface PermissionGapTableProps {
  identities: Identity[];
}

export function PermissionGapTable({ identities }: PermissionGapTableProps): React.ReactElement {
  const sorted = [...identities].sort((a, b) => calcGap(b.granted, b.used) - calcGap(a.granted, a.used));

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Permission Gap Analysis</h2>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="p-4 font-medium">Identity</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Granted</th>
              <th className="p-4 font-medium">Used</th>
              <th className="p-4 font-medium">Gap %</th>
              <th className="p-4 font-medium">Risk</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {sorted.map((identity) => {
              const gap = calcGap(identity.granted, identity.used);
              const gapColor = gap > 80 ? 'text-red-400' : gap > 50 ? 'text-amber-400' : 'text-green-400';
              return (
                <tr key={identity.id} className="hover:bg-neutral-800/30 transition">
                  <td className="p-4">
                    <p className="font-medium text-neutral-200">{identity.name}</p>
                    {identity.email && <p className="text-xs text-neutral-500">{identity.email}</p>}
                  </td>
                  <td className="p-4"><IdentityTypeBadge type={identity.type} /></td>
                  <td className="p-4 text-neutral-300">{identity.granted}</td>
                  <td className="p-4 text-neutral-300">{identity.used}</td>
                  <td className="p-4">
                    <span className={`font-medium ${gapColor}`}>{gap}%</span>
                  </td>
                  <td className="p-4"><RiskBadge score={identity.riskScore} /></td>
                  <td className="p-4">
                    <button className="rounded-lg bg-info px-3 py-1.5 text-xs font-medium text-white hover:bg-info transition">
                      Right-size
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
