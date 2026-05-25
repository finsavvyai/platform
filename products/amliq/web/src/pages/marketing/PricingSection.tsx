import { useState } from 'react'
import PricingToggle from './PricingToggle'
import PricingCard from './PricingCard'

const plans = [
  { name: 'Sandbox', subtitle: '(Evaluation only)', monthly: 0, features: [
    '10 screenings/mo', 'OFAC + UN + EU lists', 'REST API', 'Multi-layer matching',
    'Community support', '7-day retention',
  ]},
  { name: 'Pro', monthly: 299, highlighted: true, features: [
    '50,000 screenings/mo', 'All 86 sanctions lists', '3M+ entity database',
    'Disambiguation cascade', 'Freetext screening', 'Batch screening',
    'Webhooks & MFA', 'Priority support', '90-day retention',
  ]},
  { name: 'Enterprise', monthly: 0, enterprise: true, features: [
    'Unlimited screenings', 'Custom list uploads', 'On-premise deployment',
    'SAML SSO (coming soon)', 'Dedicated CSM + SLA', 'Self-hosted option',
    'Crypto wallet screening', 'Transaction orchestration',
  ]},
]

export default function PricingSection() {
  const [annual, setAnnual] = useState(false)

  return (
    <section id="pricing" className="py-20 sm:py-28 px-4" style={{ background: 'var(--bg-secondary)' }}>
      <div className="max-w-6xl mx-auto">
        <p className="section-eyebrow text-center mb-4">Pricing</p>
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4"
          style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Simple, transparent pricing
        </h2>
        <p className="text-center mb-10 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Start with a sandbox. Scale to production. No hidden fees.
        </p>
        <PricingToggle annual={annual} onChange={setAnnual} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {plans.map(p => (
            <PricingCard key={p.name} plan={p} annual={annual} />
          ))}
        </div>
      </div>
    </section>
  )
}
