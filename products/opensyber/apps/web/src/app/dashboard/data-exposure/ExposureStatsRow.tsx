'use client';

import { Link2, Share2, UserX, FileWarning } from 'lucide-react';
import type { ExposureStats } from './types';

interface Props {
  stats: ExposureStats;
}

export function ExposureStatsRow({ stats }: Props): React.ReactElement {
  const cards = [
    {
      label: 'Anonymous Links Shared',
      value: stats.anonymousLinks.toLocaleString(),
      subtitle: `avg org has ${stats.avgOrgLinks.toLocaleString()}`,
      icon: Link2,
      color: 'text-amber-400',
    },
    {
      label: 'External Shares Active',
      value: stats.externalShares.toLocaleString(),
      subtitle: 'files shared externally',
      icon: Share2,
      color: 'text-info',
    },
    {
      label: 'PII Records Exposed',
      value: stats.piiRecords.toLocaleString(),
      subtitle: 'across all services',
      icon: UserX,
      color: 'text-red-400',
    },
    {
      label: 'Unencrypted Sensitive Files',
      value: stats.unencryptedFiles.toLocaleString(),
      subtitle: 'require encryption',
      icon: FileWarning,
      color: 'text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">{c.label}</p>
            <c.icon className={`h-5 w-5 ${c.color}`} />
          </div>
          <p className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</p>
          <p className="mt-1 text-xs text-neutral-500">{c.subtitle}</p>
        </div>
      ))}
    </div>
  );
}
