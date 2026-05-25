import { btnGesturePrimary, btnGesture, cardGesture } from '../styles/gestures'

const planImages: Record<string, string> = {
  Pro: '/plan-pro.png',
  Team: '/plan-team.png',
}

interface PricingCardProps {
  name: string
  price: string
  period: string
  desc: string
  features: string[]
  highlight?: boolean
}

function handlePlanClick(name: string) {
  if (name === 'Free') {
    window.location.href = 'https://app.pushci.dev'
    return
  }
  const plan = name.toLowerCase()
  window.location.href = `https://app.pushci.dev/billing?upgrade=${plan}`
}

export function PricingCard({ name, price, period, desc, features, highlight }: PricingCardProps) {
  return (
    <div
      className={`rounded-lg border p-6 sm:p-8 flex flex-col card-hover ${cardGesture} ${
        highlight
          ? 'border-accent/30 bg-accent/[0.03]'
          : 'border-border-base bg-surface'
      }`}
    >
      {planImages[name] && (
        <img src={planImages[name]} alt={`${name} plan`} className="w-full h-32 object-cover rounded-lg mb-4 opacity-90" />
      )}
      <div className="flex items-center gap-3">
        <h3 className="text-section text-t1">{name}</h3>
        {highlight && (
          <span className="text-[10px] font-medium text-accent bg-accent/10 px-2 py-0.5 rounded">
            Popular
          </span>
        )}
      </div>
      <div className="mt-5 flex items-baseline gap-1">
        <span className="text-2xl sm:text-3xl md:text-4xl font-bold text-t1 tracking-tight">{price}</span>
        <span className="text-body text-t3">{period}</span>
      </div>
      <p className="mt-3 text-body text-t3">{desc}</p>
      <ul className="mt-6 flex-1 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-body text-t2">
            <svg className="w-4 h-4 mt-0.5 text-accent shrink-0" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={() => handlePlanClick(name)}
        className={`mt-8 block w-full rounded-lg py-2.5 text-center text-sm font-medium ease-spring cursor-pointer focus-glow ${
          highlight
            ? `bg-t1 text-root hover:bg-white ${btnGesturePrimary}`
            : `border border-border-em text-t2 hover:border-t3 hover:text-t1 ${btnGesture}`
        }`}
      >
        {price === '$0' ? 'Get Started — Free' : `Upgrade to ${name}`}
      </button>
    </div>
  )
}
