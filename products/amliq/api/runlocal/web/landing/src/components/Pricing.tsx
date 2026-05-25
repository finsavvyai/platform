import { PricingCard } from './PricingCard'
import { plans } from './pricingData'

export function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6 border-t border-zinc-800/50">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          Simple, transparent pricing
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-zinc-400">
          Start free. Upgrade when you need more.
        </p>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <PricingCard key={p.name} {...p} />
          ))}
        </div>
      </div>
    </section>
  )
}
