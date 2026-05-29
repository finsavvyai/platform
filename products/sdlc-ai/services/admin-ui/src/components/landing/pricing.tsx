'use client'

import { Check } from 'lucide-react'

interface Tier {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  ctaHref: string
  popular: boolean
}

const tiers: Tier[] = [
  {
    name: 'Starter',
    price: '$0',
    period: '/mo',
    description: 'For teams exploring AI operations',
    features: [
      '1,000 API calls/mo',
      '100MB vector storage',
      '2 RAG pipelines',
      'Community support',
      'Basic DLP rules',
    ],
    cta: 'Start Free',
    ctaHref: '/signup',
    popular: false,
  },
  {
    name: 'Business',
    price: '$199',
    period: '/mo',
    description: 'For growing teams with compliance needs',
    features: [
      '100K API calls/mo',
      '10GB vector storage',
      'Unlimited RAG pipelines',
      'SOC 2 + HIPAA compliance',
      'Advanced DLP + audit logs',
      'Email support (24h SLA)',
    ],
    cta: 'Start Free Trial',
    ctaHref: '/signup?plan=business',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For regulated industries at scale',
    features: [
      'Unlimited API calls',
      'Unlimited vector storage',
      'Custom model routing',
      'SOC 2 + HIPAA + PCI-DSS + GDPR',
      'Dedicated infrastructure',
      '24/7 support + SLA',
    ],
    cta: 'Contact Sales',
    ctaHref: '/contact',
    popular: false,
  },
]

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <Check className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
      <span className="text-sm text-muted-foreground">{text}</span>
    </li>
  )
}

function TierCard({ tier }: { tier: Tier }) {
  const cardClass = tier.popular
    ? 'rounded-2xl border-2 border-blue-600 p-8 bg-white dark:bg-slate-900 shadow-xl relative'
    : 'rounded-2xl border p-8 bg-white dark:bg-slate-900'

  const buttonClass = tier.popular
    ? `min-h-[44px] w-full rounded-xl text-base font-semibold
       bg-[#F59E0B] text-[#1E293B] hover:bg-amber-400
       transition-colors duration-200 cursor-pointer
       shadow-lg shadow-amber-500/20`
    : `min-h-[44px] w-full rounded-xl text-base font-semibold
       text-[#1E293B] dark:text-white border-2 border-slate-200
       dark:border-slate-700 hover:border-slate-300
       dark:hover:border-slate-600 transition-colors duration-200
       cursor-pointer`

  return (
    <div className={cardClass}>
      {tier.popular && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1
            rounded-full bg-blue-600 text-white text-xs font-semibold"
        >
          Most Popular
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-1">{tier.name}</h3>
        <p className="text-sm text-muted-foreground">{tier.description}</p>
      </div>

      <div className="mb-8">
        <span className="text-4xl font-bold">{tier.price}</span>
        {tier.period && (
          <span className="text-sm text-muted-foreground">{tier.period}</span>
        )}
      </div>

      <ul className="space-y-3 mb-8">
        {tier.features.map((feature) => (
          <FeatureItem key={feature} text={feature} />
        ))}
      </ul>

      <a href={tier.ctaHref} className={buttonClass}>
        <span className="flex items-center justify-center h-full">
          {tier.cta}
        </span>
      </a>
    </div>
  )
}

export function Pricing() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-center">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mt-4">
            Start free. Scale as you grow. Enterprise plans with custom SLAs.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-16">
          {tiers.map((tier) => (
            <TierCard key={tier.name} tier={tier} />
          ))}
        </div>
      </div>
    </section>
  )
}
