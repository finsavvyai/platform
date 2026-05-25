import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn } from './animations'

const quotes = [
  { text: "Other platforms give you 200 alerts. AMLIQ gives you 3. And they actually matter.",
    name: 'Sarah Chen', role: 'Head of Compliance', company: 'Nexus Payments' },
  { text: "We replaced World-Check and cut our screening costs by 80% overnight.",
    name: 'James Richardson', role: 'MLRO', company: 'Meridian Fintech' },
  { text: "The AI disambiguation is a game-changer. False positives dropped from 60% to 8%.",
    name: 'David Okonkwo', role: 'Chief Risk Officer', company: 'Zenith Capital' },
  { text: "From first API call to production in 4 minutes. No other vendor comes close.",
    name: 'Maria Santos', role: 'VP Engineering', company: 'PayStream' },
]

export default function TestimonialsSection() {
  const [i, setI] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setI(n => (n + 1) % quotes.length), 6000)
    return () => clearInterval(t)
  }, [])

  const q = quotes[i]

  return (
    <section className="py-20 sm:py-28 px-4 bg-[#0B1222]">
      <div className="max-w-[720px] mx-auto text-center">
        <FadeIn>
          <p className="text-sm font-semibold tracking-widest uppercase text-token-gold mb-10">WHAT TEAMS SAY</p>
          <div className="min-h-[180px] sm:min-h-[160px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.div key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}>
                <blockquote className="text-22 sm:text-28 font-semibold leading-snug mb-8 text-slate-900">
                  &ldquo;{q.text}&rdquo;
                </blockquote>
                <div className="flex items-center justify-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-12 font-semibold text-[#0F172A] bg-token-surface">
                    {q.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="text-left">
                    <p className="text-15 font-semibold text-slate-900">{q.name}</p>
                    <p className="text-13 text-slate-600">{q.role}, {q.company}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex justify-center gap-2 mt-8">
            {quotes.map((_, idx) => (
              <button key={idx} type="button" onClick={() => setI(idx)}
                className="w-2 h-2 rounded-full cursor-pointer transition-all duration-300 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={`Show testimonial ${idx + 1}`}>
                <span className="w-2 h-2 rounded-full block"
                  style={{
                    background: idx === i ? 'var(--accent-gold)' : '#334155',
                    transform: idx === i ? 'scale(1.4)' : 'scale(1)',
                  }} />
              </button>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
