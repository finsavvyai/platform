import { Check, X } from 'lucide-react'

type Val = true | false | string
interface Row { feature: string; amliq: Val; worldCheck: Val; dowJones: Val }

const rows: Row[] = [
  { feature: 'Starting Price', amliq: '$299/mo', worldCheck: '$15K+/yr', dowJones: '$10K+/yr' },
  { feature: 'Screening Latency', amliq: 'Real-time (in-memory)', worldCheck: 'Batch file delivery', dowJones: 'Batch file delivery' },
  { feature: 'Integration Time', amliq: 'Minutes', worldCheck: 'Weeks', dowJones: 'Weeks' },
  { feature: 'Explainable Results', amliq: true, worldCheck: false, dowJones: false },
  { feature: 'List Coverage', amliq: '26+ lists', worldCheck: '40+ lists', dowJones: '30+ lists' },
  { feature: 'Matching Layers', amliq: '4 active + 2 in rollout', worldCheck: '2 layers', dowJones: '1 layer' },
  { feature: 'Custom Thresholds', amliq: true, worldCheck: false, dowJones: false },
  { feature: 'Self-Hosted Option', amliq: true, worldCheck: false, dowJones: false },
]

function Cell({ val, highlight }: { val: Val; highlight?: boolean }) {
  if (val === true) return <Check size={16} className={highlight ? 'text-emerald-600 mx-auto' : 'text-slate-600 mx-auto'} />
  if (val === false) return <X size={16} className="text-slate-300 mx-auto" />
  return <span className={`text-sm ${highlight ? 'text-slate-900 font-semibold' : 'text-slate-600'}`}>{val}</span>
}

export default function ComparisonTable() {
  const heads = ['Feature', 'AMLIQ', 'World-Check', 'Dow Jones']

  return (
    <section className="py-20 sm:py-28 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <p className="text-xs font-semibold tracking-widest uppercase text-token-gold text-center mb-4">
          COMPARISON
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 text-center mb-12">
          AMLIQ vs Legacy Providers
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[360px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {heads.map((h, i) => (
                  <th key={h} className={`py-3 px-5 text-sm font-semibold ${i === 1 ? 'text-token-gold' : 'text-slate-600'} ${i === 0 ? 'text-left' : 'text-center'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.feature} className={`border-b border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/50' : ''}`}>
                  <td className="py-3 px-5 text-sm text-slate-700">{r.feature}</td>
                  <td className="py-3 text-center bg-token-gold/30"><Cell val={r.amliq} highlight /></td>
                  <td className="py-3 text-center"><Cell val={r.worldCheck} /></td>
                  <td className="py-3 text-center"><Cell val={r.dowJones} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
