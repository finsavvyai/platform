import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeUp } from './animations'

const quotes = [
  "Other platforms give you 200 alerts. AMLIQ gives you 3. And they actually matter.",
  "Less noise. More signal. Finally.",
  "The real luxury isn't automation -- it's confidence.",
  "False positives aren't just annoying -- they're expensive.",
  "Fewer alerts. Better decisions.",
  "Everyone's building dashboards. AMLIQ is building decisions.",
]

export default function QuoteRotator() {
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setIdx(i => (i + 1) % quotes.length), 5000)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <FadeUp>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-600 font-semibold mb-10">
            What compliance teams are saying
          </p>
          <div className="min-h-[100px] sm:min-h-[80px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.blockquote key={idx}
                className="text-2xl sm:text-3xl font-semibold text-slate-900 leading-snug"
                style={{ letterSpacing: '-0.01em' }}
                initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -16, filter: 'blur(4px)' }}
                transition={{ duration: 0.5 }}>
                &ldquo;{quotes[idx]}&rdquo;
              </motion.blockquote>
            </AnimatePresence>
          </div>
          <div className="flex justify-center gap-2 mt-10">
            {quotes.map((_, i) => (
              <motion.button key={i} type="button" onClick={() => setIdx(i)}
                className="w-8 h-8 rounded-full cursor-pointer flex items-center justify-center min-h-[44px] min-w-[44px]"
                aria-label={`Show quote ${i + 1}`}>
                <motion.span
                  className="w-2 h-2 rounded-full block"
                  style={{ background: i === idx ? 'var(--accent-gold)' : '#334155' }}
                  animate={{ scale: i === idx ? 1.3 : 1 }}
                  transition={{ type: 'spring', stiffness: 300 }} />
              </motion.button>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  )
}
