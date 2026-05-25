import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { AlertTriangle, DollarSign, Clock, EyeOff } from 'lucide-react';

const painPoints = [
  {
    icon: AlertTriangle,
    title: 'Excessive False Positives',
    desc: 'Legacy tools flag common names without context, burying real risks in noise and wasting analyst time.',
    accent: '#C0392B',
    accentBg: 'rgba(192,57,43,0.08)',
    accentBorder: 'rgba(192,57,43,0.15)',
    stat: '97%',
    statLabel: 'of alerts are false positives',
  },
  {
    icon: DollarSign,
    title: 'Unsustainable Costs',
    desc: 'Enterprise contracts start at $15K–$50K per year with opaque per-seat pricing and lock-in clauses.',
    accent: '#B7791F',
    accentBg: 'rgba(183,121,31,0.08)',
    accentBorder: 'rgba(183,121,31,0.15)',
    stat: '$50K+',
    statLabel: 'average annual licensing cost',
  },
  {
    icon: Clock,
    title: 'Slow Batch Processing',
    desc: 'Batch-only systems delay customer onboarding and block real-time transaction processing flows.',
    accent: '#6B7280',
    accentBg: 'rgba(107,114,128,0.08)',
    accentBorder: 'rgba(107,114,128,0.15)',
    stat: '24h+',
    statLabel: 'average onboarding delay',
  },
  {
    icon: EyeOff,
    title: 'Zero Transparency',
    desc: 'Black-box scoring with no explanation of why a match was returned or missed. No audit trail.',
    accent: '#C0392B',
    accentBg: 'rgba(192,57,43,0.08)',
    accentBorder: 'rgba(192,57,43,0.15)',
    stat: '0%',
    statLabel: 'match explainability',
  },
];

export default function ProblemSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-24 sm:py-32 px-4 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, var(--bg) 0%, var(--bg-secondary) 100%)' }} />
      <div className="absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: `radial-gradient(circle, rgba(201,169,110,0.8) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-4" style={{ color: 'rgba(192,57,43,0.8)' }}>
            The Problem
          </p>
          <h2 className="text-3xl sm:text-[2.6rem] font-bold tracking-tight mb-4" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
            Sanctions screening is broken
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: 'color-mix(in srgb, var(--text) 45%, transparent)' }}>
            Legacy tools create more work than they prevent. Every false positive wastes analyst time. Every missed match creates regulatory risk.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {painPoints.map((p, i) => (
            <motion.div
              key={p.title}
              className="relative rounded-2xl p-6 overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${p.accentBorder}` }}
              initial={{ opacity: 0, y: 24 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.09 }}
              whileHover={{ y: -3, background: 'rgba(255,255,255,0.05)' }}
            >
              <div className="absolute top-0 inset-x-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)`, opacity: 0.4 }} />

              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: p.accentBg, border: `1px solid ${p.accentBorder}` }}>
                <p.icon className="w-5 h-5" style={{ color: p.accent }} />
              </div>

              <p className="text-[2rem] font-bold leading-none mb-1 tracking-tight" style={{ color: p.accent }}>{p.stat}</p>
              <p className="text-[10px] font-medium mb-4" style={{ color: 'color-mix(in srgb, var(--text) 30%, transparent)' }}>{p.statLabel}</p>

              <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text)' }}>{p.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'color-mix(in srgb, var(--text) 45%, transparent)' }}>{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
