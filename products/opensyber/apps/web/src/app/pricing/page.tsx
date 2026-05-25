import { auth } from '@/lib/auth';
import { buildCheckoutUrl } from '@/lib/lemonsqueezy';
import { SiteHeader } from '@/components/SiteHeader';
import { TrustFunnelNotice } from '@/components/trust/TrustFunnelNotice';
import { appendTrustQuery, readTrustQueryContext, toUrlSearchParams } from '../trust/[id]/trust-attribution';
import { KeyRound } from 'lucide-react';
import { plans } from './plans';
import { BillingToggle } from './BillingToggle';
import { PricingHero, StatsBar } from './PricingHero';
import { MSSPSection } from './MSSPSection';
import { LaunchOfferBanner } from './LaunchOfferBanner';
import { SocialProofBar } from './SocialProofBar';
import { ComparisonTable } from './ComparisonTable';
import type { PlanKey } from './plans';

/** Launch window deal — update the expiry to extend/retire the banner. */
const LAUNCH_OFFER_EXPIRES_AT = '2026-05-15T23:59:59Z';

export const metadata = { title: 'Pricing' };

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const trustContext = readTrustQueryContext(toUrlSearchParams(resolvedSearchParams));
  let user = null;
  try {
    const session = await auth();
    user = session?.user
      ? { id: (session.user as Record<string, unknown>).id as string, email: session.user.email }
      : null;
  } catch { /* Auth not configured */ }

  const checkoutUrls: Partial<Record<PlanKey, string | null>> | null = user
    ? {
        team: buildCheckoutUrl('team'),
        professional: buildCheckoutUrl('professional'),
      }
    : null;

  const signupHref = appendTrustQuery('/sign-up', trustContext);
  const salesHref = appendTrustQuery('/enterprise', trustContext);

  return (
    <div className="min-h-screen bg-void">
      <SiteHeader />
      <main className="pt-36 md:pt-44 pb-20 md:pb-28">
        <div className="mx-auto max-w-7xl px-6">
          <PricingHero />
          <StatsBar />
          <SocialProofBar />

          <LaunchOfferBanner expiresAt={LAUNCH_OFFER_EXPIRES_AT} />

          <TrustFunnelNotice
            context={trustContext}
            event="trust_pricing_view"
            title="Trust-page visitor in pricing flow"
            description="You arrived from a live OpenSyber trust page."
          />

          <BillingToggle
            plans={plans}
            checkoutUrls={checkoutUrls}
            isSignedIn={!!user}
            signupHref={signupHref}
            salesHref={salesHref}
          />

          <ComparisonTable />

          <MSSPSection salesHref={salesHref} />

          <div className="mt-12 rounded-2xl border px-6 py-5 flex items-start gap-4"
            style={{ background: 'rgba(77,158,255,0.04)', borderColor: 'rgba(77,158,255,0.12)' }}>
            <KeyRound className="h-5 w-5 shrink-0 text-info mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                TokenForge is included from Professional tier.
              </p>
              <p className="text-sm mt-1 text-text-secondary">
                Device-bound session security for your developers.{' '}
                <a href="https://tokenforge.opensyber.cloud" target="_blank" rel="noopener noreferrer" className="font-medium text-info hover:underline">
                  Learn about TokenForge &rarr;
                </a>
              </p>
            </div>
          </div>

          <p className="text-center text-sm text-text-dim mt-12">
            Start free forever. Upgrade anytime. No credit card required.
          </p>
        </div>
      </main>
    </div>
  );
}
