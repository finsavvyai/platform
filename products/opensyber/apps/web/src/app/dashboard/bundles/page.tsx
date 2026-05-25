import Link from 'next/link';
import { Package, CheckCircle, Clock, XCircle, Store } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';

export const metadata = { title: 'My Bundles' };

interface Bundle {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  icon: string | null;
  skillCount: number;
  tier: string;
}

interface UserBundle {
  id: string;
  bundleId: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
  startedAt: string;
  expiresAt: string | null;
  bundle: Bundle;
}

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  active: { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Active' },
  paused: { icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'Paused' },
  cancelled: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Cancelled' },
  expired: { icon: XCircle, color: 'text-text-dim', bg: 'bg-surface', label: 'Expired' },
};

const bundleIcons: Record<string, string> = {
  shield: '\u{1F6E1}\u{FE0F}',
  code: '\u{1F4BB}',
  cloud: '\u2601\u{FE0F}',
  lock: '\u{1F512}',
  rocket: '\u{1F680}',
};

function getBundleEmoji(icon: string | null): string {
  return (icon && bundleIcons[icon]) ? bundleIcons[icon] : '\u{1F4E6}';
}

export default async function BundlesPage() {
  let userBundles: UserBundle[] = [];

  try {
    const token = await getApiToken();
    if (token) {
      const res = await apiClient<{ data: UserBundle[] }>('/api/user/bundles', { token });
      userBundles = res.data ?? [];
    }
  } catch {
    // API not available
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Bundles</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage your active security bundles
          </p>
        </div>
        <Link
          href="/dashboard/marketplace?tab=bundles"
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition min-h-[44px]"
        >
          <Store className="h-4 w-4" />
          Browse Bundles
        </Link>
      </div>

      {userBundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
            <Package className="h-6 w-6 text-text-secondary" />
          </div>
          <h3 className="text-base font-semibold mb-1">No bundles activated</h3>
          <p className="text-sm text-text-secondary max-w-sm mb-4">
            Bundles group related security skills together for easy deployment.
          </p>
          <Link href="/dashboard/marketplace?tab=bundles" className="text-sm text-signal hover:text-signal-hover">
            Browse bundles &rarr;
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {userBundles.map((ub) => {
            const status = statusConfig[ub.status] ?? statusConfig.active;
            const StatusIcon = status.icon;
            return (
              <Link
                key={ub.id}
                href={`/dashboard/bundles/${ub.bundle.id}`}
                className="group rounded border border-border bg-panel/30 p-5 transition-colors hover:border-wire"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl" role="img" aria-label={ub.bundle.name}>
                      {getBundleEmoji(ub.bundle.icon)}
                    </span>
                    <div>
                      <h3 className="text-sm font-medium">{ub.bundle.name}</h3>
                      <p className="text-xs text-text-dim">{ub.bundle.skillCount} skills</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${status.color} ${status.bg}`}>
                    <StatusIcon className="h-3 w-3" aria-hidden="true" />
                    {status.label}
                  </span>
                </div>
                {ub.bundle.tagline && (
                  <p className="mt-3 text-xs text-text-secondary line-clamp-2">{ub.bundle.tagline}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
