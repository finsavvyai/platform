import { Zap, Search, TrendingUp, Database, Layers, ClipboardList, FileText, Code2 } from 'lucide-react'
import type { ReactNode } from 'react'

interface Feature {
  icon: ReactNode
  title: string
  desc: string
  code: string
}

const features: Feature[] = [
  { icon: <Zap size={20} />, title: 'Real-time screening API', desc: 'Sub-50ms decisions on entities, counterparties, and transactions. Synchronous REST, no queueing.', code: 'POST /v1/screen' },
  { icon: <Search size={20} />, title: 'Fuzzy & phonetic matching', desc: 'Exact, token, fuzzy, phonetic, transliteration, and graph layers tuned per list.', code: 'matcher.strategy = "hybrid"' },
  { icon: <TrendingUp size={20} />, title: 'AI risk scoring', desc: 'Calibrated risk scores per hit, combining list severity, geography, and behavioral signals.', code: 'risk_score: 0.83' },
  { icon: <Search size={20} />, title: 'False positive reduction', desc: 'Context-aware disambiguation cuts manual review volume by up to 70% without missing true hits.', code: 'fp_reduction: 68%' },
  { icon: <Database size={20} />, title: 'Transaction monitoring', desc: 'Rules, velocity, structuring, and sanctions checks on every payment leg.', code: 'stream.tx → decision' },
  { icon: <ClipboardList size={20} />, title: 'Audit logs', desc: 'Immutable per-request evidence: input, match, score, policy version, decision, reviewer.', code: 'GET /v1/audit/{id}' },
  { icon: <FileText size={20} />, title: 'Case management', desc: 'Queue, triage, assign, escalate, and resolve — with SAR-ready export and reviewer SLAs.', code: 'case.status = "escalated"' },
  { icon: <Code2 size={20} />, title: 'Batch + streaming', desc: 'Screen millions of records overnight or sub-second per event via Kafka, Webhooks, and REST.', code: 'POST /v1/batch' },
  { icon: <Layers size={20} />, title: 'Global list coverage', desc: 'OFAC, EU, UN, HMT, OFSI, NBCTF, INTERPOL and 200+ PEP / adverse media sources.', code: 'lists: 200+' },
]

function Card({ icon, title, desc, code }: Feature) {
  return (
    <div className="group relative bg-slate-50 rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 border border-slate-200 hover:border-token-gold/30">
      <div className="w-10 h-10 rounded-lg bg-token-gold/10 flex items-center justify-center mb-4 text-token-gold group-hover:bg-token-gold/20 transition-colors">
        {icon}
      </div>
      <h3 className="text-slate-900 font-semibold mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed mb-3">{desc}</p>
      <code className="text-[11px] font-mono text-token-gold/80 bg-token-surface/[0.05] px-2 py-1 rounded">
        {code}
      </code>
    </div>
  )
}

export default function FeaturesGrid() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <p className="text-sm text-token-gold font-semibold text-center mb-3 uppercase tracking-widest">
          Capabilities
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 text-center mb-4">
          One API for end-to-end compliance
        </h2>
        <p className="text-slate-600 text-center mb-16 max-w-2xl mx-auto">
          Purpose-built screening, scoring, and case infrastructure. Drop it into your payment flow and keep regulators, auditors, and customers happy.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => <Card key={f.title} {...f} />)}
        </div>
      </div>
    </section>
  )
}
