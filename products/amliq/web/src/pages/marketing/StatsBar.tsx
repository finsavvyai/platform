import { useEffect, useRef, useState } from 'react'
import { FadeIn } from './animations'

const stats = [
  { value: 3000000, suffix: '+', label: 'Entities', format: true },
  { value: 6, suffix: '', label: 'AI Layers' },
  { value: 1, suffix: 'ms', label: 'Latency', prefix: '<' },
  { value: 86, suffix: '', label: 'Lists' },
]

function Counter({ value, suffix = '', prefix = '', format = false }: {
  value: number; suffix?: string; prefix?: string; format?: boolean
}) {
  const [n, setN] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        let step = 0
        const total = 40
        const timer = setInterval(() => {
          step++
          setN(value * (1 - Math.pow(1 - step / total, 3)))
          if (step >= total) clearInterval(timer)
        }, 28)
      }
    }, { threshold: 0.5 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [value])

  const display = format ? Math.floor(n).toLocaleString() : Math.floor(n).toString()

  return (
    <div ref={ref} className="text-center">
      <p className="text-40 sm:text-48 font-bold tracking-tight"
        style={{ background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        {prefix}{display}{suffix}
      </p>
    </div>
  )
}

export default function StatsBar() {
  return (
    <section className="py-16 sm:py-20 px-4 bg-[#0B1222] border-b border-slate-200">
      <FadeIn>
        <div className="max-w-[980px] mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <Counter value={s.value} suffix={s.suffix} prefix={s.prefix} format={s.format} />
              <p className="text-13 mt-1 text-slate-600">{s.label}</p>
            </div>
          ))}
        </div>
      </FadeIn>
    </section>
  )
}
