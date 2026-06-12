import { ArrowLeftRight, Landmark, Wallet, CreditCard } from 'lucide-react'

const cases = [
  {
    icon: ArrowLeftRight,
    title: 'Remittance Providers',
    problem: 'High transaction volumes with name-heavy sender/receiver data.',
    solution: 'Batch API screens thousands of transfers per second with phonetic matching for cross-border name variants.',
  },
  {
    icon: Landmark,
    title: 'Banks and Neobanks',
    problem: 'Onboarding delays from excessive false positives on common names.',
    solution: 'Multi-layer scoring separates real hits from noise, materially cutting review queues versus single-layer tools (see /benchmarks for reproducible numbers).',
  },
  {
    icon: Wallet,
    title: 'Crypto Platforms',
    problem: 'Wallet addresses linked to sanctioned entities across multiple chains.',
    solution: 'Screen wallet addresses against sanctioned address databases with chain-level attribution.',
  },
  {
    icon: CreditCard,
    title: 'Payment Processors',
    problem: 'Real-time transaction screening without adding latency to payment flows.',
    solution: 'Real-time API responses (sub-50ms target) integrate directly into payment authorization pipelines.',
  },
]

export default function UseCasesSection() {
  return (
    <section className="py-20 sm:py-28 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <p className="text-xs font-semibold tracking-widest uppercase text-token-gold text-center mb-4">
          USE CASES
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 text-center mb-14">
          Built for regulated industries
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {cases.map(c => (
            <div key={c.title} className="border border-slate-200 rounded-xl p-7 bg-white">
              <c.icon size={20} className="text-token-gold mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{c.title}</h3>
              <p className="text-sm text-slate-600 mb-3">
                <span className="font-medium text-slate-700">Challenge: </span>{c.problem}
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-700">Solution: </span>{c.solution}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
