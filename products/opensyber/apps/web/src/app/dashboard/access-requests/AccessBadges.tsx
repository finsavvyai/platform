'use client';

import type { AccessLevel, RequestStatus } from './types';

const levelStyles: Record<AccessLevel, string> = {
  'read-only': 'bg-info/10 text-info',
  'read-write': 'bg-amber-500/10 text-amber-400',
  admin: 'bg-red-500/10 text-red-400',
};

const statusStyles: Record<RequestStatus, string> = {
  approved: 'bg-green-500/10 text-green-400',
  denied: 'bg-red-500/10 text-red-400',
  expired: 'bg-neutral-800 text-neutral-400',
  revoked: 'bg-amber-500/10 text-amber-400',
  pending: 'bg-info/10 text-info',
};

export function LevelBadge({ level }: { level: AccessLevel }): React.ReactElement {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${levelStyles[level]}`}>
      {level}
    </span>
  );
}

export function StatusBadge({ status }: { status: RequestStatus }): React.ReactElement {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[status]}`}>
      {status}
    </span>
  );
}
