import { motion } from 'framer-motion'
import { Zap, Brain, Globe, Eye, DollarSign, Shield } from 'lucide-react'
import { FadeIn, StaggerGroup, staggerChild } from './animations'

const edges = [
  { icon: Zap, stat: '2-tier', label: 'Matching engine', detail: 'In-memory instant index + database-scale search' },
  { icon: Brain, stat: '92%', label: 'Fewer false positives', detail: 'LLM cascade for disambiguation' },
  { icon: Globe, stat: '2.2M+', label: 'Entity profiles', detail: 'Growing to 5M+ from 328 sources' },
  { icon: Eye, stat: '6', label: 'Matching layers', detail: 'Fully explainable scoring' },
  { icon: DollarSign, stat: '100x', label: 'Cheaper', detail: '$299/mo vs $30K+ for legacy' },
  { icon: Shield, stat: '26+', label: 'Country lists', detail: 'OFAC, UN, EU, UK + regional' },
]

export default function CompetitiveEdge() {
  return (
    <section className="py-20 sm:py-28 px-4">
      <div className="max-w-[980px] mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-sm font-semibold tracking-widest uppercase text-token-gold mb-4">WHY AMLIQ</p>
            <h2 className="text-32 sm:text-48 font-bold text-slate-900">
              Outperform legacy screening.
            </h2>
          </div>
        </FadeIn>
        <StaggerGroup>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {edges.map(e => (
              <motion.div key={e.label} variants={staggerChild}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-token-gold/10">
                    <e.icon size={17} className="text-token-gold" />
                  </div>
                  <span className="text-32 font-bold text-token-gold">{e.stat}</span>
                </div>
                <p className="text-15 font-semibold mb-0.5 text-slate-900">{e.label}</p>
                <p className="text-13 text-slate-600">{e.detail}</p>
              </motion.div>
            ))}
          </div>
        </StaggerGroup>
      </div>
    </section>
  )
}
