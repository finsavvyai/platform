import { Link } from 'react-router-dom'
import { PricingCard } from './PricingCard'
import { plans } from './pricingData'
import { useReveal } from './useReveal'
import { CurbShare } from './CurbShare'

export function Pricing() {
  const ref = useReveal()

  return (
    <section id="pricing" ref={ref} className="reveal py-20 sm:py-32 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-t1">
          Pricing
        </h2>
        <p className="mt-3 text-t2 max-w-lg">
          Start free. No credit card. Upgrade when you need more.
        </p>
        <div className="mt-4 rounded-lg border border-accent/20 bg-accent/[0.04] px-4 py-3 text-sm text-t2">
          Use code <span className="font-semibold text-accent">AMISRAEL2026</span> at checkout for 5% off Pro and Team plans
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4 lg:items-start">
          {plans.map((p) => (
            <div key={p.name} className={p.highlight ? 'lg:-mt-4 lg:mb-4' : ''}>
              <PricingCard {...p} />
            </div>
          ))}
        </div>
        <p className="mt-6 text-body text-t3">
          Not sure how much you're spending?{' '}
          <Link to="/tools/cost-calculator" className="text-t1 hover:text-accent transition-colors duration-200 underline underline-offset-4 decoration-border-base">
            Calculate your CI costs
          </Link>
        </p>
        <div className="mt-10 max-w-xl">
          <CurbShare />
        </div>
      </div>
    </section>
  )
}
