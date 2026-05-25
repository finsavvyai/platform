import { useNavigate } from 'react-router-dom'
import { Shield, Zap, Globe, Brain, Layers, BarChart3 } from 'lucide-react'
import { motion } from 'framer-motion'
import { FadeUp, ScaleIn } from './animations'

const features = [
  { icon: Layers, label: 'Multi-Layer Matching', detail: 'Exact, Fuzzy, Phonetic, Token, Embedding, Graph' },
  { icon: Zap, label: 'Sub-50ms Screening', detail: '18,699+ entities screened in real-time' },
  { icon: Globe, label: 'Global List Coverage', detail: 'OFAC, UN, EU, UK OFSI, IL NBCTF, OpenSanctions' },
  { icon: Shield, label: 'PEP + RCA Screening', detail: 'Politicians, relatives, close associates' },
  { icon: Brain, label: 'Explainable Results', detail: 'Every match shows why it matched and how' },
  { icon: BarChart3, label: 'Ongoing Monitoring', detail: 'Continuous re-screening when lists update' },
]

export default function ProductShowcase() {
  const navigate = useNavigate()

  return (
    <section className="px-4 pb-24 pt-8">
      <div className="max-w-5xl mx-auto">
        <ScaleIn>
          <div className="relative rounded-2xl overflow-hidden bg-slate-50 border border-slate-200"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="flex items-center gap-2 px-4 py-3 bg-white">
              <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
              <span className="w-3 h-3 rounded-full bg-[#C9A96E]" />
              <span className="w-3 h-3 rounded-full bg-[#22C55E]" />
              <span className="ml-4 text-xs text-slate-600">AMLIQ Dashboard</span>
            </div>
            <div className="p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-8 mb-10">
                {features.map((f, i) => (
                  <FadeUp key={f.label} delay={i * 0.08}>
                    <motion.div className="flex gap-4 items-start group"
                      whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 300 }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-gold-light)', border: '1px solid color-mix(in srgb, var(--accent-gold) 15%, transparent)' }}>
                        <f.icon size={18} style={{ color: 'var(--accent-gold)' }} />
                      </div>
                      <div>
                        <p className="text-slate-900 font-semibold text-sm">{f.label}</p>
                        <p className="text-slate-600 text-xs mt-1 leading-relaxed">{f.detail}</p>
                      </div>
                    </motion.div>
                  </FadeUp>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <p className="text-slate-900 font-semibold">See it screening real data</p>
                  <p className="text-slate-600 text-sm mt-1">18,699+ OFAC entities</p>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => navigate('/signup')}
                    className="px-6 py-3 font-semibold text-sm rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-px min-h-[44px]"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text)', boxShadow: '0 4px 12px rgba(26,24,20,0.2)' }}>
                    Request Sandbox Access
                  </button>
                  <button type="button"
                    onClick={() => window.open('https://calendly.com/amliq', '_blank')}
                    className="px-6 py-3 text-sm rounded-xl cursor-pointer border border-slate-200 hover:border-slate-300 transition-all min-h-[44px] text-slate-700">
                    Book a Demo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ScaleIn>
      </div>
    </section>
  )
}
