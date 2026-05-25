'use client';

import { motion } from 'framer-motion';
import { PlanCard } from './PlanCard';
import type { Plan } from './PlanCard';

const ease = [0.25, 0.1, 0.25, 1] as const;

const plans: Plan[] = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    description: 'For developers who need to know if their sessions are being hijacked',
    features: [
      '10K verifications/mo',
      '1,000 active sessions',
      'Community support',
      'Basic trust scoring',
      'Single project',
    ],
    cta: 'Start Free',
    href: '/sign-up',
    external: false,
    popular: false,
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/mo',
    description: 'For production apps where one stolen session means one breached user',
    features: [
      '50K verifications/mo',
      '5K active sessions',
      'Email support',
      'Step-up authentication',
      'Custom thresholds',
      'Webhook alerts',
      '5 projects',
    ],
    cta: 'Subscribe to Pro',
    href: '/pricing',
    external: false,
    popular: true,
  },
  {
    name: 'Team',
    price: '$199',
    period: '/mo',
    description: 'For teams where one compromised session could compromise the whole org',
    features: [
      '250K verifications/mo',
      '25K active sessions',
      'Priority support',
      'SSO integration',
      'Team management',
      'Audit logs',
      '20 projects',
    ],
    cta: 'Subscribe to Team',
    href: '/pricing',
    external: false,
    popular: false,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For organizations with compliance needs',
    features: [
      'Unlimited verifications',
      'Unlimited sessions',
      'Dedicated support + SLA',
      'Data residency',
      'Custom integrations',
      'SOC2 compliance reports',
      'Unlimited projects',
    ],
    cta: 'Contact Sales',
    href: 'mailto:sales@opensyber.cloud?subject=TokenForge%20Enterprise%20Inquiry',
    external: true,
    popular: false,
  },
];

export function PricingSection(): React.ReactElement {
  return (
    <section className="py-24 md:py-32 border-t border-border/50 bg-panel/40">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-16"
        >
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
            Pricing
          </span>
          <h2 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-4">Simple, Transparent Pricing</h2>
          <p className="text-text-secondary max-w-xl mx-auto text-lg">
            Start free. Scale as your app grows. No hidden fees.
          </p>
        </motion.div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => (
            <PlanCard key={plan.name} plan={plan} index={i} />
          ))}
        </div>

        <p className="text-center text-sm text-text-muted mt-12">
          All plans include cryptographic device binding, trust scoring, and graceful degradation.
        </p>

        <motion.a
          href="https://opensyber.cloud/sse"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease }}
          data-testid="sse-bundle-callout"
          className="block mx-auto max-w-3xl mt-12 rounded border border-border/60 bg-panel/30 p-6 transition hover:border-info/60 hover:bg-panel/60 focus-visible:ring-2 focus-visible:ring-info"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em]">
                Bundle with OpenSyber SSE
              </p>
              <p className="mt-2 text-lg font-semibold">
                Replace Cisco Duo + Secure Internet Access — from $25/user/mo
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Self-hosted SWG, RBI, DNS firewall, and workload protection alongside TokenForge MFA.
                25–40% under Cisco list pricing.
              </p>
            </div>
            <span className="font-[family-name:var(--font-mono)] text-xs text-info self-end sm:self-auto">
              Learn more →
            </span>
          </div>
        </motion.a>
      </div>
    </section>
  );
}
