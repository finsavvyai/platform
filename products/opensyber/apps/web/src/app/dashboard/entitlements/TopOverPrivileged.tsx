'use client';

import type { Identity } from './types';
import { calcGap } from './types';
import { IdentityTypeBadge, RiskBadge } from './EntitlementBadges';

interface TopOverPrivilegedProps {
  identities: Identity[];
}

function PermissionBar({ granted, used }: { granted: number; used: number }): React.ReactElement {
  const maxVal = Math.max(granted, 1);
  const usedPct = Math.round((used / maxVal) * 100);

  return (
    <div className="w-40">
      <div className="h-3 w-full rounded-full bg-neutral-800 overflow-hidden">
        <div className="h-full rounded-full bg-info" style={{ width: `${usedPct}%` }} />
      </div>
      <div className="flex justify-between mt-1 text-xs text-neutral-500">
        <span>{used} used</span>
        <span>{granted} granted</span>
      </div>
    </div>
  );
}

function formatLastActive(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function TopOverPrivileged({ identities }: TopOverPrivilegedProps): React.ReactElement {
  const overPriv = identities
    .filter((i) => calcGap(i.granted, i.used) >= 50)
    .sort((a, b) => calcGap(b.granted, b.used) - calcGap(a.granted, a.used))
    .slice(0, 8);

  if (overPriv.length === 0) return <></>;

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Top Over-Privileged Identities</h2>
      <div className="space-y-3">
        {overPriv.map((identity) => (
          <div key={identity.id} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <IdentityTypeBadge type={identity.type} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-200">{identity.name}</p>
                <p className="text-xs text-neutral-500">Last active: {formatLastActive(identity.lastActive)}</p>
              </div>
            </div>
            <PermissionBar granted={identity.granted} used={identity.used} />
            <RiskBadge score={identity.riskScore} />
            <button className="rounded-lg border border-red-800 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition">
              Remediate
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
