import { Check } from 'lucide-react'

interface Plan {
  name: string; monthly: number; features: string[]
  subtitle?: string; highlighted?: boolean; enterprise?: boolean
}

export default function PricingCard({ plan, annual }: { plan: Plan; annual: boolean }) {
  const price = annual ? Math.round(plan.monthly * 0.8) : plan.monthly
  const hl = plan.highlighted

  return (
    <div className="relative flex flex-col p-7 rounded-2xl transition-all duration-200"
      style={{
        background: hl ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
        border: hl ? 'none' : '1px solid var(--separator)',
        boxShadow: hl ? '0 24px 64px rgba(26,24,20,0.2)' : 'var(--shadow-sm)',
      }}>
      {hl && (
        <div className="absolute -top-3 left-6 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full"
          style={{ background: 'var(--accent-gold)', color: '#FFFFFF' }}>
          Most Popular
        </div>
      )}
      <div className="mb-4">
        <h3 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          {plan.name}
        </h3>
        {plan.subtitle && (
          <span className="text-sm" style={{ color: hl ? 'color-mix(in srgb, var(--text) 60%, transparent)' : 'var(--text-secondary)' }}>
            {plan.subtitle}
          </span>
        )}
      </div>
      {plan.enterprise ? (
        <p className="text-3xl font-bold mb-6" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Custom
        </p>
      ) : price === 0 ? (
        <p className="text-3xl font-bold mb-6" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Free
        </p>
      ) : (
        <div className="mb-6">
          <span className="text-4xl font-bold" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
            ${price}
          </span>
          <span className="text-sm ml-1" style={{ color: hl ? 'color-mix(in srgb, var(--text) 50%, transparent)' : 'var(--text-tertiary)' }}>
            /mo
          </span>
        </div>
      )}
      <button type="button"
        className="w-full py-3 rounded-[10px] text-sm font-semibold mb-6 cursor-pointer transition-all duration-200 min-h-[44px] hover:-translate-y-px"
        style={
          hl || plan.enterprise
            ? { background: 'var(--accent-gold)', color: '#FFFFFF', boxShadow: '0 8px 24px rgba(201,169,110,0.3)' }
            : { border: '1.5px solid var(--separator)', color: 'var(--text-secondary)', background: 'transparent' }
        }
        onClick={
    plan.enterprise
      ? () => window.open('https://calendly.com/amliq', '_blank')
      : price === 0
        ? () => window.location.href = '/signup'
        : () => window.open('https://calendly.com/amliq', '_blank')
  }>
        {plan.enterprise ? 'Contact Sales' : price === 0 ? 'Request Sandbox Access' : 'Book a Demo'}
      </button>
      <ul className="space-y-3 flex-1">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2.5">
            <Check size={14} className="shrink-0 mt-0.5" style={{ color: hl ? 'var(--accent-gold)' : '#2D7A4F' }} />
            <span className="text-sm" style={{ color: hl ? 'color-mix(in srgb, var(--text) 75%, transparent)' : 'var(--text-secondary)' }}>
              {f}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
