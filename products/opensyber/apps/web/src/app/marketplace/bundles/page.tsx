import Link from 'next/link';
import { Shield, Sparkles, ArrowLeft, Check } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { SiteHeader } from '@/components/SiteHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Skill Bundles — OpenSyber Marketplace' };

interface BundleInfo {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  tier: string;
  priceCents: number;
  skillCount: number;
  icon: string | null;
}

const tierGradients: Record<string, string> = {
  free: 'from-green-500 to-emerald-600',
  pro: 'from-signal to-cyan-600',
  team: 'from-info to-info',
  enterprise: 'from-purple-500 to-violet-600',
};

const tierLabels: Record<string, string> = {
  free: 'Free', pro: 'Pro', team: 'Team', enterprise: 'Enterprise',
};

export default async function BundlesPage() {
  let bundles: BundleInfo[] = [];

  try {
    const data = await apiClient<{ bundles: BundleInfo[] }>('/api/bundles');
    bundles = data.bundles;
  } catch {
    /* API unavailable — show empty state */
  }

  const freeBundles = bundles.filter((b) => b.priceCents === 0);
  const paidBundles = bundles.filter((b) => b.priceCents > 0);

  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <div className="pt-24 pb-12 md:pb-20">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <Link
            href="/marketplace"
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-white transition"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Skills
          </Link>

          <div className="mb-10">
            <h1 className="text-2xl md:text-3xl font-bold">
              Skill Bundles
            </h1>
            <p className="text-sm text-text-secondary mt-1 max-w-xl">
              Pre-packaged skill sets targeting specific security domains.
              Installing a bundle enables every skill it contains.
            </p>
          </div>

          {bundles.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-10">
              {freeBundles.length > 0 && (
                <BundleSection title="Free Starter" bundles={freeBundles} />
              )}
              {paidBundles.length > 0 && (
                <BundleSection title="Pro Bundles" bundles={paidBundles} />
              )}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-border py-12">
        <div className="mx-auto max-w-7xl px-6 flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div className="flex items-center gap-2 text-sm text-text-dim">
            <Shield className="h-4 w-4" />
            <span>&copy; 2026 OpenSyber. All rights reserved.</span>
          </div>
          <div className="flex gap-6 text-sm text-text-dim">
            <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
            <Link href="/marketplace" className="hover:text-white transition">Skills</Link>
            <Link href="/docs" className="hover:text-white transition">Docs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function BundleSection({ title, bundles }: { title: string; bundles: BundleInfo[] }) {
  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Sparkles className="h-5 w-5 text-signal" aria-hidden="true" />
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {bundles.map((b) => (
          <PublicBundleCard key={b.id} bundle={b} />
        ))}
      </div>
    </div>
  );
}

function PublicBundleCard({ bundle }: { bundle: BundleInfo }) {
  const gradient = tierGradients[bundle.tier] ?? tierGradients.free;

  return (
    <div className="group rounded border border-border bg-panel/30 overflow-hidden transition-colors hover:border-wire">
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold">{bundle.name}</h3>
            {bundle.tagline && (
              <p className="mt-0.5 text-xs text-text-secondary">{bundle.tagline}</p>
            )}
          </div>
          <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-secondary">
            {tierLabels[bundle.tier] ?? bundle.tier}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-text-dim mb-4">
          <Check className="h-3 w-3 text-signal" />
          <span>{bundle.skillCount} skills included</span>
        </div>

        <div className="flex items-end justify-between">
          {bundle.priceCents === 0 ? (
            <span className="text-sm font-semibold text-green-400">Free</span>
          ) : (
            <span className="text-sm font-semibold">
              ${(bundle.priceCents / 100).toFixed(0)}/mo
            </span>
          )}

          <Link
            href="/sign-up"
            className="rounded-lg bg-signal px-4 py-2 text-xs font-medium text-white min-h-[44px] flex items-center transition-colors hover:bg-signal-hover"
          >
            Get Started
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Sparkles className="h-8 w-8 text-text-dim mb-3" aria-hidden="true" />
      <h3 className="text-base font-semibold mb-1">Bundles coming soon</h3>
      <p className="text-sm text-text-secondary max-w-sm">
        Skill bundles will be available here shortly. Check back soon!
      </p>
    </div>
  );
}
