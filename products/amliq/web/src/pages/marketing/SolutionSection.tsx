import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Target, Gauge, SlidersHorizontal, Check } from 'lucide-react';

const pillars = [
  {
    icon: Target,
    title: 'Accuracy',
    subtitle: 'Fewer false positives. More real matches.',
    points: [
      'Multi-layer matching materially reduces false positives versus single-layer tools (see /benchmarks)',
      'Deterministic and probabilistic layers work in concert',
      'Every result includes score breakdown and source attribution',
    ],
    accent: 'var(--accent-gold)',
    accentBg: 'var(--accent-gold-light)',
    accentBorder: 'color-mix(in srgb, var(--accent-gold) 13%, transparent)',
    featured: false,
  },
  {
    icon: Gauge,
    title: 'Performance',
    subtitle: 'Real-time. Zero cold starts.',
    points: [
      'Single-entity screening with a sub-50ms p99 latency target',
      'Batch API for bulk portfolio processing',
      'In-memory engine with zero cold starts',
    ],
    accent: '#3DAA6A',
    accentBg: 'rgba(61,170,106,0.08)',
    accentBorder: '#3DAA6A22',
    featured: true,
  },
  {
    icon: SlidersHorizontal,
    title: 'Control',
    subtitle: 'Your rules. Your thresholds. Your audit trail.',
    points: [
      'Configurable match thresholds per use case',
      'Custom list uploads and exclusion rules',
      'Full audit trail with exportable logs',
    ],
    accent: 'var(--accent-gold)',
    accentBg: 'var(--accent-gold-light)',
    accentBorder: 'color-mix(in srgb, var(--accent-gold) 13%, transparent)',
    featured: false,
  },
];

export default function SolutionSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} id="features" className="relative py-24 sm:py-32 px-4 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'var(--text)' }} />

      <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-gold) 40%, transparent), transparent)' }} />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="section-eyebrow mb-4">How AMLIQ solves it</p>
          <h2 className="text-3xl sm:text-[2.6rem] font-bold tracking-tight mb-4" style={{ color: 'var(--bg-elevated)', letterSpacing: '-0.02em' }}>
            Accuracy. Performance. Control.
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: '#5C5852' }}>
            Built from the ground up for production compliance workflows.
            Not a wrapper around legacy data feeds.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              className="relative rounded-2xl p-7 overflow-hidden"
              style={{
                background: p.featured ? 'var(--bg-elevated)' : '#FFFFFF',
                border: p.featured ? 'none' : '1px solid #E8E5DF',
                boxShadow: p.featured ? '0 20px 60px rgba(26,24,20,0.18)' : '0 1px 3px rgba(26,24,20,0.04)',
              }}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              whileHover={{ y: -4, boxShadow: p.featured ? '0 28px 72px rgba(26,24,20,0.25)' : '0 8px 24px rgba(26,24,20,0.1)' }}
            >
              {p.featured && (
                <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-gold) 60%, transparent), transparent)' }} />
              )}

              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: p.accentBg, border: `1px solid ${p.accentBorder}` }}>
                <p.icon className="w-5 h-5" style={{ color: p.accent }} />
              </div>

              <h3 className="text-xl font-bold mb-1" style={{ color: p.featured ? 'var(--text)' : 'var(--bg-elevated)' }}>{p.title}</h3>
              <p className="text-sm mb-5" style={{ color: p.featured ? 'color-mix(in srgb, var(--text) 50%, transparent)' : '#9E9A94' }}>{p.subtitle}</p>

              <ul className="space-y-3">
                {p.points.map(pt => (
                  <li key={pt} className="flex items-start gap-2.5 text-sm" style={{ color: p.featured ? 'color-mix(in srgb, var(--text) 68%, transparent)' : '#5C5852' }}>
                    <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: p.accent }} />
                    {pt}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
