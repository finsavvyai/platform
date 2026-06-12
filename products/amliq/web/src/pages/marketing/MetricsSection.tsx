import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Zap, Database, Shield, Activity } from 'lucide-react';

const metrics = [
  {
    value: 'Real-time',
    label: 'Screening response',
    icon: Zap,
    accent: 'var(--accent-gold)',
    accentBg: 'var(--accent-gold-light)',
    detail: 'in-memory instant index',
  },
  {
    value: '26+',
    label: 'Sanctions & watchlists',
    icon: Shield,
    accent: '#3DAA6A',
    accentBg: 'rgba(61,170,106,0.1)',
    detail: 'OFAC · UN · EU · FATF + more',
  },
  {
    value: '1M+',
    label: 'Entity records searchable',
    icon: Database,
    accent: 'var(--accent-gold)',
    accentBg: 'var(--accent-gold-light)',
    detail: 'refreshed every 4 hours',
  },
  {
    value: '99.9%',
    label: 'Uptime target',
    icon: Activity,
    accent: '#3DAA6A',
    accentBg: 'rgba(61,170,106,0.1)',
    detail: 'multi-region redundancy',
  },
];

export default function MetricsSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section ref={ref} className="relative py-24 sm:py-32 px-4 overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-gold) 35%, transparent), transparent)' }} />
      <div className="absolute bottom-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-gold) 20%, transparent), transparent)' }} />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="section-eyebrow mb-4">Operational metrics</p>
          <h2 className="text-3xl sm:text-[2.6rem] font-bold tracking-tight mb-4" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Production-grade infrastructure
          </h2>
          <p className="text-base max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Numbers that matter when your compliance runs at scale.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          {metrics.map((m, i) => (
            <motion.div
              key={m.label}
              className="relative rounded-2xl p-6 overflow-hidden"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--separator)',
                boxShadow: 'var(--shadow-xs)',
              }}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.45, delay: i * 0.09, ease: [0.25, 0.1, 0.25, 1] }}
              whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(26,24,20,0.1)' }}
            >
              <div className="absolute top-0 inset-x-0 h-0.5" style={{ background: `linear-gradient(90deg, transparent, color-mix(in srgb, ${m.accent} 33%, transparent), transparent)` }} />

              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: m.accentBg }}>
                <m.icon className="w-4.5 h-4.5" style={{ color: m.accent, width: 18, height: 18 }} />
              </div>

              <p className="text-4xl font-bold mb-1 tabular-nums" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
                {m.value}
              </p>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>{m.label}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{m.detail}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="relative rounded-2xl overflow-hidden"
          style={{ background: 'var(--bg-elevated)' }}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.45 }}
        >
          <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-gold) 70%, transparent), transparent)' }} />
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, var(--accent-gold), transparent)' }} />

          <div className="relative px-8 py-7 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-0 sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'color-mix(in srgb, var(--accent-gold) 70%, transparent)' }}>Peak throughput</p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
                50,000
                <span className="text-xl font-medium ml-2" style={{ color: 'color-mix(in srgb, var(--text) 50%, transparent)' }}>entities / sec</span>
              </p>
            </div>
            <div className="h-px sm:h-14 sm:w-px bg-white/10 self-stretch" />
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'color-mix(in srgb, var(--accent-gold) 70%, transparent)' }}>Cold-start latency</p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
                0ms
                <span className="text-xl font-medium ml-2" style={{ color: 'color-mix(in srgb, var(--text) 50%, transparent)' }}>always warm</span>
              </p>
            </div>
            <div className="h-px sm:h-14 sm:w-px bg-white/10 self-stretch" />
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: 'color-mix(in srgb, var(--accent-gold) 70%, transparent)' }}>False positive reduction</p>
              <p className="text-3xl sm:text-4xl font-bold tabular-nums" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
                90%
                <span className="text-xl font-medium ml-2" style={{ color: 'color-mix(in srgb, var(--text) 50%, transparent)' }}>vs legacy</span>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
