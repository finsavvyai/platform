import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FadeIn, ScaleIn } from './animations'

const layers = [
  { name: 'Exact', score: 100, color: 'var(--accent-gold)', desc: 'Direct name/alias' },
  { name: 'Fuzzy', score: 92, color: 'var(--accent-gold)', desc: 'Edit distance' },
  { name: 'Phonetic', score: 88, color: '#4F46E5', desc: 'Soundex' },
  { name: 'Token', score: 85, color: '#A78BFA', desc: 'Token-set' },
  { name: 'Embedding', score: 79, color: '#7C3AED', desc: 'Vector' },
  { name: 'Graph', score: 71, color: '#D97706', desc: 'Network' },
]

function Bar({ name, score, color, desc, delay }: {
  name: string; score: number; color: string; desc: string; delay: number
}) {
  const [w, setW] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setTimeout(() => setW(score), delay); obs.disconnect() }
    }, { threshold: 0.3 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [score, delay])

  return (
    <div ref={ref}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-15 font-semibold text-slate-900">{name}</span>
        <span className="text-12 text-slate-600">{desc}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-white">
        <motion.div className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${w}%` }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1], delay: delay / 1000 }} />
      </div>
    </div>
  )
}

export default function MatchingLayers() {
  return (
    <section id="matching" className="py-20 sm:py-28 px-4">
      <div className="max-w-[640px] mx-auto">
        <FadeIn>
          <p className="text-sm font-semibold tracking-widest uppercase text-token-gold text-center mb-4">MATCHING ENGINE</p>
          <h2 className="text-32 sm:text-48 font-bold text-center mb-4 text-slate-900">
            Six independent matching layers.
          </h2>
          <p className="text-17 text-center mb-14 text-slate-600">
            Every entity flows through six independent matching layers.
            Each score is weighted and explained.
          </p>
        </FadeIn>
        <ScaleIn>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5">
            <p className="text-13 font-mono text-slate-600">
              screening &quot;Mohammad Ali Hassan&quot;
            </p>
            {layers.map((l, i) => <Bar key={l.name} {...l} delay={i * 180} />)}
          </div>
        </ScaleIn>
      </div>
    </section>
  )
}
