'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { PricingGrid, PricingRow, PricingCard } from '@/components/motion/PricingGrid';
import { ANNUAL_DISCOUNT_PERCENT } from './plans';
import type { PlanData, PlanKey } from './plans';

interface BillingToggleProps {
  plans: PlanData[];
  checkoutUrls: Partial<Record<PlanKey, string | null>> | null;
  isSignedIn: boolean;
  signupHref: string;
  salesHref: string;
}

export function BillingToggle({ plans, checkoutUrls, isSignedIn, signupHref, salesHref }: BillingToggleProps) {
  const [isAnnual, setIsAnnual] = useState(false);
  const selfServe = plans.filter((p) => !p.contactSales);
  const contactPlans = plans.filter((p) => p.contactSales);

  return (
    <>
      <ToggleSwitch isAnnual={isAnnual} onToggle={() => setIsAnnual(!isAnnual)} />
      <PricingGrid>
        {selfServe.map((plan) => (
          <PlanCard
            key={plan.planKey} plan={plan} isAnnual={isAnnual}
            checkoutUrls={checkoutUrls} isSignedIn={isSignedIn}
            signupHref={signupHref} salesHref={salesHref}
          />
        ))}
      </PricingGrid>
      {contactPlans.length > 0 && (
        <PricingRow>
          {contactPlans.map((plan) => (
            <PlanCard
              key={plan.planKey} plan={plan} isAnnual={isAnnual}
              checkoutUrls={checkoutUrls} isSignedIn={isSignedIn}
              signupHref={signupHref} salesHref={salesHref}
            />
          ))}
        </PricingRow>
      )}
    </>
  );
}

function ToggleSwitch({ isAnnual, onToggle }: { isAnnual: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-12">
      <span className={`text-sm font-medium transition ${!isAnnual ? 'text-white' : 'text-text-dim'}`}>Monthly</span>
      <button
        type="button" role="switch" aria-checked={isAnnual}
        aria-label="Toggle annual billing" onClick={onToggle}
        className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-wire bg-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal data-[state=checked]:bg-signal/20"
        data-state={isAnnual ? 'checked' : 'unchecked'}
      >
        <span className={`pointer-events-none block h-5 w-5 rounded-full shadow-lg transition-transform mt-0.5 ${
          isAnnual ? 'translate-x-[22px] bg-signal' : 'translate-x-0.5 bg-text-secondary'
        }`} />
      </button>
      <span className={`text-sm font-medium transition ${isAnnual ? 'text-white' : 'text-text-dim'}`}>Annual</span>
      {isAnnual && (
        <span className="rounded-full bg-signal/10 border border-signal/20 px-2.5 py-0.5 text-xs font-medium text-signal">
          Save {ANNUAL_DISCOUNT_PERCENT}%
        </span>
      )}
    </div>
  );
}

function PlanCard({ plan, isAnnual, checkoutUrls, isSignedIn, signupHref, salesHref }: {
  plan: PlanData; isAnnual: boolean;
  checkoutUrls: Partial<Record<PlanKey, string | null>> | null;
  isSignedIn: boolean; signupHref: string; salesHref: string;
}) {
  const isFree = plan.planKey === 'free';
  const checkoutUrl = !isFree && !plan.contactSales ? checkoutUrls?.[plan.planKey] : null;
  // When signed in on a paid plan but no checkout URL is available (env vars missing
  // or LemonSqueezy variant not configured), fall back to the sales contact page
  // instead of silently dropping the user on /dashboard.
  const paidFallback = checkoutUrl ?? salesHref;
  const href = plan.contactSales ? salesHref
    : isFree ? (isSignedIn ? '/dashboard' : signupHref)
    : (isSignedIn ? paidFallback : signupHref);
  const isExternal = !!checkoutUrl && isSignedIn && !isFree;
  const usesFallback = !isFree && !plan.contactSales && isSignedIn && !checkoutUrl;
  const monthlyEquiv = isAnnual && !isFree ? (plan.annualPrice / 12).toFixed(0) : null;

  return (
    <PricingCard popular={plan.popular}>
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-signal px-3 py-1 text-xs font-medium">
          Most Popular
        </div>
      )}
      <h3 className="text-xl font-semibold">{plan.name}</h3>
      <p className="mt-1 text-sm text-text-secondary">{plan.description}</p>
      <PriceDisplay plan={plan} isFree={isFree} isAnnual={isAnnual} monthlyEquiv={monthlyEquiv} />
      <CTAButton
        plan={plan}
        href={href}
        isExternal={isExternal}
        isFree={isFree}
        isSignedIn={isSignedIn}
        usesFallback={usesFallback}
      />
      <ul className="mt-8 space-y-3">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-text-primary">
            <Check className="h-4 w-4 mt-0.5 text-ok flex-shrink-0" />{f}
          </li>
        ))}
      </ul>
    </PricingCard>
  );
}

function PriceDisplay({ plan, isFree, isAnnual, monthlyEquiv }: {
  plan: PlanData; isFree: boolean; isAnnual: boolean; monthlyEquiv: string | null;
}) {
  if (plan.contactSales) {
    return <div className="mt-6 mb-8"><span className="text-3xl font-bold">${plan.price.toLocaleString()}</span><span className="text-text-secondary">/mo</span></div>;
  }
  return (
    <div className="mt-6 mb-8">
      {isFree ? <span className="text-4xl font-bold">$0</span> : isAnnual ? (
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">${monthlyEquiv}</span>
            <span className="text-text-secondary">/mo</span>
          </div>
          <p className="text-xs text-text-dim mt-1">${plan.annualPrice.toLocaleString()}/yr billed annually</p>
        </div>
      ) : (
        <><span className="text-4xl font-bold">${plan.price}</span><span className="text-text-secondary">/mo</span></>
      )}
    </div>
  );
}

function CTAButton({ plan, href, isExternal, isFree, isSignedIn, usesFallback }: {
  plan: PlanData; href: string; isExternal: boolean; isFree: boolean; isSignedIn: boolean;
  usesFallback: boolean;
}) {
  const cls = `flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
    plan.popular ? 'bg-signal text-void hover:bg-signal-hover glow-signal-sm hover:glow-signal font-bold'
      : isFree ? 'bg-ok hover:bg-[#3ddb8c] text-void font-bold'
      : plan.contactSales ? 'border border-signal/40 text-signal hover:bg-signal/10'
      : 'border border-border hover:border-signal/30 hover:bg-signal/5'
  }`;
  const label = plan.contactSales
    ? plan.cta
    : usesFallback ? 'Contact Sales'
    : (isSignedIn && !isFree ? 'Go to Dashboard' : plan.cta);

  const button = isExternal
    ? <a href={href} className={`${cls} lemonsqueezy-button`}>{label} <ArrowRight className="h-4 w-4" /></a>
    : <Link href={href} className={cls}>{label} <ArrowRight className="h-4 w-4" /></Link>;

  if (usesFallback) {
    return (
      <div className="space-y-2">
        {button}
        <p className="text-xs text-text-secondary text-center">
          Self-serve checkout temporarily unavailable — contact sales to upgrade.
        </p>
      </div>
    );
  }
  return button;
}
