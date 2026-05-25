interface PricingCardProps {
  name: string
  price: string
  period: string
  desc: string
  features: string[]
  highlight?: boolean
}

export function PricingCard({ name, price, period, desc, features, highlight }: PricingCardProps) {
  return (
    <div
      className={`rounded-xl border p-6 flex flex-col ${
        highlight
          ? 'border-emerald-500/50 bg-emerald-500/5 ring-1 ring-emerald-500/20'
          : 'border-zinc-800 bg-zinc-900/50'
      }`}
    >
      <h3 className="text-lg font-semibold">{name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-sm text-zinc-500">{period}</span>
      </div>
      <p className="mt-2 text-sm text-zinc-400">{desc}</p>
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
            <span className="mt-0.5 text-emerald-400">&#10003;</span>
            {f}
          </li>
        ))}
      </ul>
      <a
        href="#"
        className={`mt-8 block rounded-lg py-2.5 text-center text-sm font-medium transition ${
          highlight
            ? 'bg-emerald-500 text-black hover:bg-emerald-400'
            : 'border border-zinc-700 text-zinc-300 hover:border-zinc-500'
        }`}
      >
        {price === '$0' ? 'Get Started Free' : 'Start Trial'}
      </a>
    </div>
  )
}
