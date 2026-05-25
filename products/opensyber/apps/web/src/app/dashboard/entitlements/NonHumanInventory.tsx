'use client';

import { Bot } from 'lucide-react';
import type { Identity } from './types';
import { IdentityTypeBadge } from './EntitlementBadges';

interface NonHumanInventoryProps {
  identities: Identity[];
}

function isStale(dateStr: string): boolean {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff > 90 * 86400000;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function NonHumanInventory({ identities }: NonHumanInventoryProps): React.ReactElement {
  const nonHuman = identities.filter((i) => i.type !== 'human');

  if (nonHuman.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-12 text-center mb-8">
        <Bot className="mx-auto mb-4 h-12 w-12 text-neutral-600" />
        <p className="text-lg font-medium text-neutral-300">No non-human identities found</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Non-Human Identity Inventory</h2>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Owner</th>
              <th className="p-4 font-medium">Created</th>
              <th className="p-4 font-medium">Last Used</th>
              <th className="p-4 font-medium">Permissions</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {nonHuman.map((identity) => {
              const stale = isStale(identity.lastActive);
              return (
                <tr key={identity.id} className={`hover:bg-neutral-800/30 transition ${stale ? 'bg-amber-500/5' : ''}`}>
                  <td className="p-4">
                    <p className="font-medium text-neutral-200">{identity.name}</p>
                    {stale && <span className="text-xs text-amber-400">Stale - unused &gt;90 days</span>}
                  </td>
                  <td className="p-4"><IdentityTypeBadge type={identity.type} /></td>
                  <td className="p-4 text-neutral-300">{identity.owner ?? 'Unknown'}</td>
                  <td className="p-4 text-neutral-400 text-xs">{formatDate(identity.createdAt)}</td>
                  <td className="p-4 text-neutral-400 text-xs">{formatDate(identity.lastActive)}</td>
                  <td className="p-4 text-neutral-300">{identity.granted}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500 transition">
                        Rotate
                      </button>
                      <button className="rounded-lg border border-red-800 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition">
                        Disable
                      </button>
                    </div>
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
