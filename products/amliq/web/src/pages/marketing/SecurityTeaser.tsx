import { Link } from 'react-router-dom'
import { Shield, FileCheck, Lock, Eye, Server, BookOpen } from 'lucide-react'

const items = [
  { icon: Eye, label: 'Explainable scoring' },
  { icon: FileCheck, label: 'Full audit logs' },
  { icon: Lock, label: 'Encryption at rest and in transit' },
  { icon: Server, label: 'Self-hosted deployment option' },
  { icon: Shield, label: 'Configurable data retention' },
  { icon: BookOpen, label: 'Compliance documentation' },
]

export default function SecurityTeaser() {
  return (
    <section className="py-20 sm:py-28 px-4 bg-white">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-xs font-semibold tracking-widest uppercase text-token-gold mb-4">
          SECURITY & COMPLIANCE
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 mb-4">
          Built for regulated environments
        </h2>
        <p className="text-slate-600 mb-12 max-w-2xl mx-auto">
          AMLIQ is designed to meet the security and compliance requirements
          of financial institutions handling sensitive screening data.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
          {items.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 text-left">
              <Icon className="w-5 h-5 text-token-gold flex-shrink-0" />
              <span className="text-sm text-slate-700">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/security"
            className="px-5 py-2.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
            Security Details
          </Link>
          <Link to="/compliance"
            className="px-5 py-2.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
            Compliance & Methodology
          </Link>
        </div>
      </div>
    </section>
  )
}
