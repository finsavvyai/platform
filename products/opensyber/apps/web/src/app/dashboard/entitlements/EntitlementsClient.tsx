'use client';

import { Users } from 'lucide-react';
import type { Identity, EntitlementStats } from './types';
import { EntitlementStatsCards } from './EntitlementStatsCards';
import { PermissionGapTable } from './PermissionGapTable';
import { TopOverPrivileged } from './TopOverPrivileged';
import { NonHumanInventory } from './NonHumanInventory';
import { PermissionDistribution } from './PermissionDistribution';

export default function EntitlementsClient(): React.ReactElement {
  const identities: Identity[] = [];
  const stats: EntitlementStats = {
    totalIdentities: 0,
    overPrivileged: 0,
    unusedPermissions: 0,
    nonHumanIdentities: 0,
  };

  if (identities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-neutral-800 mb-4">
          <Users className="h-7 w-7 text-neutral-500" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">No Entitlements Data Yet</h2>
        <p className="text-sm text-neutral-400 max-w-md">
          Connect your infrastructure to start seeing identity entitlements. Data will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <>
      <EntitlementStatsCards stats={stats} />
      <PermissionGapTable identities={identities} />
      <TopOverPrivileged identities={identities} />
      <NonHumanInventory identities={identities} />
      <PermissionDistribution identities={identities} />
    </>
  );
}
