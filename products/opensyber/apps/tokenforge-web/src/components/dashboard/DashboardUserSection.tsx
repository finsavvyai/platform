'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useApi } from '@/lib/use-api';
import { fetchTenantInfo } from '@/lib/tokenforge-api';

interface TenantInfo {
  plan: string;
  name: string;
  email: string;
  used: number;
  limit: number;
}

function formatUsage(used: number, limit: number): string {
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n));
  return `${fmt(used)} / ${fmt(limit)} verifications`;
}

export function DashboardUserSection(): React.ReactElement {
  const fetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchTenantInfo(token, signal),
    [],
  );
  const { data: tenant, loading } = useApi<TenantInfo>(fetcher);

  if (loading || !tenant) {
    return (
      <div className="border-t border-border p-4">
        <div className="h-24 animate-pulse rounded-lg bg-surface/30" />
      </div>
    );
  }

  const initials = tenant.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'TF';

  return (
    <div className="border-t border-border p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-info/20 text-sm font-medium text-info">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{tenant.name}</p>
          <p className="truncate text-xs text-text-muted">{tenant.email}</p>
        </div>
      </div>
      <div className="rounded-lg bg-surface/50 p-3">
        <p className="text-xs text-text-muted">Plan</p>
        <p className="text-sm font-medium">{tenant.plan}</p>
        <p className="mt-1 text-xs text-text-muted">
          {formatUsage(tenant.used, tenant.limit)}
        </p>
        <Link
          href="/pricing"
          className="mt-2 block text-xs text-info hover:text-signal-hover"
        >
          Upgrade &rarr;
        </Link>
      </div>
    </div>
  );
}
