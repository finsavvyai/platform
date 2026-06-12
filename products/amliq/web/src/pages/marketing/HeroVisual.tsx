import { motion } from 'framer-motion'
import { Shield, CheckCircle2, AlertTriangle } from 'lucide-react'

const results = [
  { name: 'Hassan Ali Mohammad', score: 94, status: 'hit', list: 'OFAC SDN' },
  { name: 'Ali Hassan Trading Co', score: 87, status: 'review', list: 'EU Consolidated' },
  { name: 'Hassan Ali (Common)', score: 23, status: 'clear', list: 'No match' },
]

const statusColor = { hit: '#EF4444', review: 'var(--accent-gold)', clear: '#22C55E' }
const StatusIcon = ({ s }: { s: string }) =>
  s === 'clear' ? <CheckCircle2 size={14} color={statusColor.clear} />
    : <AlertTriangle size={14} color={s === 'hit' ? statusColor.hit : statusColor.review} />

export default function HeroVisual() {
  return (
    <div className="relative max-w-[720px] mx-auto">
      <div className="rounded-2xl overflow-hidden bg-slate-50 border border-slate-200"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200">
          <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
          <span className="w-3 h-3 rounded-full bg-token-gold" />
          <span className="w-3 h-3 rounded-full bg-[#22C55E]" />
          <span className="ml-4 text-12 text-slate-600">AMLIQ -- Screening Results</span>
        </div>
        <div className="p-5 space-y-2.5">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white">
            <Shield size={14} className="text-token-gold" />
            <span className="text-13 font-mono text-slate-600">
              screening &quot;Hassan Ali&quot; -- 42ms -- 4 layers
            </span>
          </div>
          {results.map((r, i) => (
            <motion.div key={r.name}
              className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white border border-[rgba(148,163,184,0.08)]"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1 + i * 0.15, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}>
              <div className="flex items-center gap-3 min-w-0">
                <StatusIcon s={r.status} />
                <div className="min-w-0">
                  <p className="text-15 font-semibold truncate text-slate-900">{r.name}</p>
                  <p className="text-12 text-slate-600">{r.list}</p>
                </div>
              </div>
              <span className="text-15 font-semibold tabular-nums shrink-0 ml-3"
                style={{ color: statusColor[r.status as keyof typeof statusColor] }}>
                {r.score}%
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
