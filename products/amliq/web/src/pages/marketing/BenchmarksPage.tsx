import { motion } from 'framer-motion'
import { FlaskConical, Clock, AlertTriangle } from 'lucide-react'
import MarketingNav from './MarketingNav'
import FooterSection from './FooterSection'

const METHODOLOGY_ITEMS = [
  'A standardized entity CSV (names, DOBs, nationalities) drawn from publicly sanctioned and clean-list entities.',
  'Each entity screened through AMLIQ and a baseline comparator under identical conditions.',
  'Metrics captured: precision (true positives / all positives), recall (true positives / all actual matches), F1 score, p99 latency, and cost per screen.',
  'Results timestamped, methodology documented, and raw data available to design-partner customers under NDA.',
]

export default function BenchmarksPage() {
  return (
    <div className="min-h-screen bg-[#0B0A09] text-white">
      <MarketingNav />

      <header className="relative overflow-hidden pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p
            className="text-xs tracking-[0.2em] uppercase mb-4"
            style={{ color: '#C9A96E' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Transparency
          </motion.p>
          <motion.h1
            className="text-4xl md:text-5xl font-bold tracking-tight mb-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Screening Benchmarks
          </motion.h1>
          <motion.p
            className="text-lg max-w-2xl mx-auto"
            style={{ color: '#9E9A94' }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Reproducible, head-to-head comparisons of AMLIQ against industry
            screening tools. No aggregate marketing claims — just numbers you
            can verify.
          </motion.p>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div
          className="rounded-2xl border p-8 md:p-12 mb-16"
          style={{ borderColor: '#2A2825', background: '#13120F' }}
        >
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle size={20} style={{ color: '#C9A96E' }} />
            <h2 className="text-xl font-semibold">Benchmark in progress</h2>
          </div>
          <p style={{ color: '#9E9A94' }} className="mb-4 leading-relaxed">
            We are building a reproducible benchmark harness that will run
            standardized entity sets through AMLIQ and publicly available
            comparators. The first published results will cover:
          </p>
          <ul className="space-y-2 mb-6" style={{ color: '#9E9A94' }}>
            {[
              'AMLIQ 4-layer cascade vs. single-layer fuzzy baseline',
              'Precision / recall / F1 across OFAC SDN, UN Consolidated, EU FSF',
              'p99 latency at 1k, 10k, 100k batch sizes',
              'Cost per screen at each pricing tier',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span style={{ color: '#C9A96E' }} className="mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
          <p className="text-sm" style={{ color: '#6B6760' }}>
            Target publication: Q3 2026. Design-partner customers can access
            early results under NDA —{' '}
            <a
              href="mailto:sales@amliq.finance"
              style={{ color: '#C9A96E' }}
              className="underline underline-offset-2"
            >
              contact sales
            </a>.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-16">
          <Card
            icon={<FlaskConical size={20} />}
            title="Methodology"
            items={METHODOLOGY_ITEMS}
          />
          <Card
            icon={<Clock size={20} />}
            title="What we measure"
            items={[
              'Precision — how many flagged entities are true matches.',
              'Recall — how many actual matches the system catches.',
              'F1 — harmonic mean of precision and recall.',
              'Latency — p50 and p99 response times per screen.',
              'Cost — dollar cost per 1,000 screens at each tier.',
            ]}
          />
        </div>

        <div
          className="rounded-2xl border p-8 text-center"
          style={{ borderColor: '#2A2825', background: '#13120F' }}
        >
          <h2 className="text-xl font-semibold mb-3">
            Want early access to benchmark data?
          </h2>
          <p className="mb-6" style={{ color: '#9E9A94' }}>
            Design-partner customers get pre-publication results, methodology
            review, and input into the test entity set.
          </p>
          <a
            href="mailto:sales@amliq.finance"
            className="inline-block px-6 py-3 rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
            style={{ background: '#C9A96E', color: '#0B0A09' }}
          >
            Request benchmark access
          </a>
        </div>
      </section>

      <FooterSection />
    </div>
  )
}

function Card({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode
  title: string
  items: string[]
}) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ borderColor: '#2A2825', background: '#13120F' }}
    >
      <div className="flex items-center gap-2 mb-4" style={{ color: '#C9A96E' }}>
        {icon}
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <ul className="space-y-2" style={{ color: '#9E9A94' }}>
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm">
            <span style={{ color: '#C9A96E' }} className="mt-0.5">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
