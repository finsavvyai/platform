import { motion } from 'framer-motion'
import { Layers, Zap, Globe, Brain, Shield, BarChart3 } from 'lucide-react'
import { FadeIn, StaggerGroup, staggerChild } from './animations'

const items = [
  { icon: Layers, title: 'Multi-Layer Matching', desc: 'Exact, Fuzzy, Phonetic, and Token layers in production today. Semantic (Embedding) and Graph layers in active rollout.', span: 'md:col-span-2' },
  { icon: Zap, title: 'Real-Time Screening', desc: 'In-memory engine screens entities in real-time. Zero cold starts.', span: '' },
  { icon: Globe, title: 'Global Coverage', desc: 'OFAC, UN, EU, UK OFSI, IL NBCTF and 20+ additional lists updated daily.', span: '' },
  { icon: Brain, title: 'Explainable Results', desc: 'Every match shows exactly why -- which layer, which tokens, what score.', span: 'md:col-span-2' },
  { icon: Shield, title: 'PEP & RCA', desc: 'Politicians, relatives, close associates across 195 countries.', span: '' },
  { icon: BarChart3, title: 'Ongoing Monitoring', desc: 'Continuous re-screening when lists update. Instant alerts.', span: 'md:col-span-2' },
]

export default function BentoFeatures() {
  return (
    <section id="features" className="py-20 sm:py-28 px-4">
      <div className="max-w-[980px] mx-auto">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-sm font-semibold tracking-widest uppercase text-token-gold mb-4">CAPABILITIES</p>
            <h2 className="text-32 sm:text-48 font-bold text-slate-900">
              Everything you need<br className="hidden sm:block" /> for compliance.
            </h2>
          </div>
        </FadeIn>
        <StaggerGroup>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {items.map(f => (
              <motion.div key={f.title} variants={staggerChild}
                className={`bg-slate-50 border border-slate-200 rounded-2xl p-7 ${f.span}`}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 bg-token-gold/10">
                  <f.icon size={20} className="text-token-gold" />
                </div>
                <h3 className="text-17 font-semibold mb-1.5 text-slate-900">{f.title}</h3>
                <p className="text-15 text-slate-600">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </StaggerGroup>
      </div>
    </section>
  )
}
