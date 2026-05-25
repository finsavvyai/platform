import Link from 'next/link';
import { ArrowLeft, Package } from 'lucide-react';
import { getApiToken } from '@/lib/auth-token';
import { apiClient } from '@/lib/api';
import { ActivateBundleButton } from './ActivateBundleButton';
import { SourceWizard } from './SourceWizard';

export const metadata = { title: 'Bundle Detail' };

interface BundleSkill {
  skillId: string;
  skillName: string;
  skillSlug: string;
  skillCategory: string;
}

interface Bundle {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  tier: string;
  priceCents: number;
  skillCount: number;
  icon: string | null;
  skills: BundleSkill[];
  isSubscribed: boolean;
}

const tierGradients: Record<string, string> = {
  free: 'from-green-500 to-emerald-600',
  pro: 'from-signal to-cyan-600',
  team: 'from-info to-info',
  enterprise: 'from-purple-500 to-violet-600',
};

export default async function BundleDetailPage({
  params,
}: {
  params: Promise<{ bundleId: string }>;
}) {
  const { bundleId } = await params;
  let bundle: Bundle | null = null;

  try {
    const token = await getApiToken();
    if (token) {
      const res = await apiClient<{ data: Bundle[] }>('/api/bundles', { token });
      bundle = res.data?.find((b) => b.id === bundleId) ?? null;
    }
  } catch {
    // API not available
  }

  if (!bundle) {
    return (
      <div className="py-16 text-center">
        <Package className="mx-auto h-8 w-8 text-text-dim mb-3" />
        <h2 className="text-lg font-semibold">Bundle not found</h2>
        <Link href="/dashboard/marketplace?tab=bundles" className="mt-2 text-sm text-signal">
          Back to marketplace &rarr;
        </Link>
      </div>
    );
  }

  const gradient = tierGradients[bundle.tier] ?? tierGradients.free;

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/marketplace?tab=bundles"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-white transition-colors min-h-[44px]"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Marketplace
      </Link>

      {/* Header */}
      <div className="rounded border border-border bg-panel/30 overflow-hidden">
        <div className={`h-2 bg-gradient-to-r ${gradient}`} />
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{bundle.name}</h1>
              {bundle.tagline && (
                <p className="mt-1 text-sm text-text-secondary">{bundle.tagline}</p>
              )}
            </div>
            <div className="text-right">
              {bundle.priceCents === 0 ? (
                <span className="text-lg font-bold text-green-400">Free</span>
              ) : (
                <span className="text-lg font-bold">${(bundle.priceCents / 100).toFixed(0)}/mo</span>
              )}
            </div>
          </div>
          {bundle.description && (
            <p className="mt-4 text-sm text-text-secondary max-w-2xl">{bundle.description}</p>
          )}
          <div className="mt-6">
            <ActivateBundleButton bundleId={bundle.id} isSubscribed={bundle.isSubscribed} />
          </div>
        </div>
      </div>

      {/* Skills list */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          Included Skills
          <span className="ml-2 text-sm font-normal text-text-dim">({bundle.skills.length})</span>
        </h2>
        <div className="rounded border border-border bg-panel/30 divide-y divide-border">
          {bundle.skills.map((s) => (
            <div key={s.skillId} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-signal" aria-hidden="true" />
                <span className="text-sm font-medium">{s.skillName}</span>
              </div>
              <span className="rounded bg-surface px-2 py-0.5 text-xs text-text-secondary capitalize">
                {s.skillCategory}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Source connection wizard (only show when subscribed) */}
      {bundle.isSubscribed && <SourceWizard bundleSlug={bundle.slug} />}
    </div>
  );
}
