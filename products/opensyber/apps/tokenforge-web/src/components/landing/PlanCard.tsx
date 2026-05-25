'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { Check, ArrowRight } from 'lucide-react';

const ease = [0.25, 0.1, 0.25, 1] as const;

export interface Plan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  external: boolean;
  popular: boolean;
}

const TEST_COUPON = process.env.NEXT_PUBLIC_LS_TEST_COUPON;

export function PlanCard({ plan, index }: { plan: Plan; index: number }): React.ReactElement {
  const { data: session } = useSession();
  const tenantId = (session?.user as Record<string, unknown>)?.tenantId as string | undefined;
  const isCheckout = plan.external && plan.href.includes('lemonsqueezy.com');
  let href = plan.href;
  if (isCheckout && tenantId) {
    href = `${plan.href}?checkout[custom][tenant_id]=${tenantId}&checkout[custom][user_id]=${tenantId}`;
  }
  if (isCheckout && TEST_COUPON) {
    href += `${href.includes('?') ? '&' : '?'}checkout[discount_code]=${TEST_COUPON}`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ delay: index * 0.1, duration: 0.5, ease }}
      className={`relative gradient-border card-hover ${
        plan.popular ? 'glow-info' : ''
      }`}
    >
      <div className={`rounded-2xl bg-panel p-8 h-full flex flex-col ${
        plan.popular ? 'ring-1 ring-info/30' : ''
      }`}>
        {plan.popular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-info text-void px-3 py-1 text-xs font-medium">
            Most Popular
          </div>
        )}

        <h3 className="text-xl font-semibold">{plan.name}</h3>
        <p className="mt-1 text-sm text-text-secondary">{plan.description}</p>

        <div className="mt-6 mb-8">
          <span className="text-4xl font-bold">{plan.price}</span>
          {plan.period && <span className="text-text-secondary">{plan.period}</span>}
        </div>

        {plan.external ? (
          <a
            href={href}
            {...(isCheckout ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            className={`flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition ${
              plan.popular
                ? 'bg-info text-void glow-info hover:brightness-110'
                : 'border border-border/50 hover:bg-surface'
            }${isCheckout ? ' lemonsqueezy-button' : ''}`}
          >
            {plan.cta} <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <Link
            href={href}
            className={`flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition ${
              plan.popular
                ? 'bg-info text-void glow-info hover:brightness-110'
                : 'border border-border/50 hover:bg-surface'
            }`}
          >
            {plan.cta} <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        <ul className="mt-8 space-y-3 flex-1">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
              <Check className="h-4 w-4 mt-0.5 text-ok shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
