import { Upload, Sparkles, Search, BarChart3, FileText, ArrowRight } from 'lucide-react'

const steps = [
  { icon: Upload, title: 'Input', desc: 'Submit entity name, aliases, and metadata via API or dashboard.' },
  { icon: Sparkles, title: 'Normalize', desc: 'Transliterate, strip diacritics, and standardize naming formats.' },
  { icon: Search, title: 'Match', desc: 'Run through six matching layers in parallel for comprehensive coverage.' },
  { icon: BarChart3, title: 'Score', desc: 'Weighted ensemble scoring produces a single confidence value per match.' },
  { icon: FileText, title: 'Explain', desc: 'Generate human-readable explanation of why each match was flagged.' },
  { icon: ArrowRight, title: 'Return', desc: 'Return ranked results with audit metadata in under 50ms.' },
]

export default function ScreeningWorkflow() {
  return (
    <section className="py-16 sm:py-24 px-4 bg-token-bg-2">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-token-fg mb-4">
          Screening Workflow
        </h2>
        <p className="text-base text-token-fg-muted mb-10 max-w-2xl">
          Every screening request follows six deterministic steps.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="bg-token-surface border border-token-line rounded-lg p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm font-semibold text-token-gold">{i + 1}</span>
                <s.icon className="w-5 h-5 text-token-fg-faint" />
              </div>
              <h3 className="text-base font-semibold text-token-fg mb-1">{s.title}</h3>
              <p className="text-sm text-token-fg-muted leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
