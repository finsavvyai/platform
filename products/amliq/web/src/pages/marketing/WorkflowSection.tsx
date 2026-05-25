import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Upload, RefreshCw, Layers, BarChart2, Send } from 'lucide-react';

const steps = [
  {
    num: '01',
    icon: Upload,
    title: 'Submit',
    desc: 'Send entity name, ID, or document via REST API or dashboard upload.',
    color: 'var(--accent-gold)',
    bg: 'var(--accent-gold-light)',
  },
  {
    num: '02',
    icon: RefreshCw,
    title: 'Normalize',
    desc: 'Transliterate, tokenize, and standardize across scripts and name formats.',
    color: '#3DAA6A',
    bg: 'rgba(61,170,106,0.08)',
  },
  {
    num: '03',
    icon: Layers,
    title: 'Match',
    desc: 'Run exact, fuzzy, phonetic, token, semantic, and network matching layers.',
    color: 'var(--accent-gold)',
    bg: 'var(--accent-gold-light)',
  },
  {
    num: '04',
    icon: BarChart2,
    title: 'Score',
    desc: 'Weight layer results into a composite confidence score with full attribution.',
    color: '#3DAA6A',
    bg: 'rgba(61,170,106,0.08)',
  },
  {
    num: '05',
    icon: Send,
    title: 'Return',
    desc: 'Deliver scored matches, explanation, source list, and exportable audit trail.',
    color: 'var(--accent-gold)',
    bg: 'var(--accent-gold-light)',
  },
];

export default function WorkflowSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-24 sm:py-32 px-4 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0F0E0B 0%, var(--bg) 100%)' }} />

      <div className="absolute inset-0" style={{
        backgroundImage: `linear-gradient(color-mix(in srgb, var(--accent-gold) 3%, transparent) 1px, transparent 1px)`,
        backgroundSize: '100% 80px',
      }} />

      <div className="relative max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <p className="section-eyebrow mb-4">How it works</p>
          <h2 className="text-3xl sm:text-[2.6rem] font-bold tracking-tight mb-4" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
            From input to decision in{' '}
            <span style={{ color: 'var(--accent-gold)' }}>under a millisecond</span>
          </h2>
          <p className="text-base max-w-lg mx-auto" style={{ color: 'color-mix(in srgb, var(--text) 45%, transparent)' }}>
            A deterministic multi-layer pipeline that returns scored, explainable results with full source attribution.
          </p>
        </motion.div>

        <div className="relative">
          <div className="hidden lg:block absolute top-10 inset-x-8" style={{ height: 1 }}>
            <motion.div
              className="h-full"
              style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-gold) 20%, transparent), color-mix(in srgb, var(--accent-gold) 20%, transparent), transparent)' }}
              initial={{ scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.2, delay: 0.4 }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                className="relative"
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
              >
                <div
                  className="relative rounded-2xl p-5 h-full"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--accent-gold-light)' }}
                >
                  <div className="absolute -top-px inset-x-4 h-px" style={{ background: `linear-gradient(90deg, transparent, ${s.color}, transparent)`, opacity: 0.6 }} />

                  <div className="flex items-center justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                      <s.icon className="w-4 h-4" style={{ color: s.color }} />
                    </div>
                    <span className="text-xs font-mono font-bold" style={{ color: 'color-mix(in srgb, var(--text) 20%, transparent)' }}>{s.num}</span>
                  </div>

                  <h3 className="text-sm font-bold mb-1.5" style={{ color: 'var(--text)' }}>{s.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'color-mix(in srgb, var(--text) 42%, transparent)' }}>{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          className="mt-10 rounded-2xl overflow-hidden max-w-2xl mx-auto"
          style={{ background: '#0E0D0B', border: '1px solid color-mix(in srgb, var(--accent-gold) 12%, transparent)' }}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <div className="flex items-center gap-2 px-5 py-2.5" style={{ borderBottom: '1px solid var(--accent-gold-light)' }}>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: 'color-mix(in srgb, var(--accent-gold) 50%, transparent)' }}>Response example</span>
            <span className="ms-auto text-[10px] font-mono" style={{ color: 'color-mix(in srgb, var(--text) 20%, transparent)' }}>latency: 0.8ms</span>
          </div>
          <div className="p-5 font-mono text-sm leading-[1.8]">
            <p style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>{'{'}</p>
            <p className="ms-4"><span style={{ color: 'var(--accent-gold)' }}>"entity"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: '#3DAA6A' }}>"Hassan Ali"</span>,</p>
            <p className="ms-4"><span style={{ color: 'var(--accent-gold)' }}>"matches"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: 'var(--text)' }}>2</span>,</p>
            <p className="ms-4"><span style={{ color: 'var(--accent-gold)' }}>"top_match"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: {'{'}</span></p>
            <p className="ms-8"><span style={{ color: 'var(--accent-gold)' }}>"score"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: 'var(--accent-gold)' }}>0.94</span>,</p>
            <p className="ms-8"><span style={{ color: 'var(--accent-gold)' }}>"list"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: '#3DAA6A' }}>"OFAC SDN"</span>,</p>
            <p className="ms-8"><span style={{ color: 'var(--accent-gold)' }}>"layers"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: 'color-mix(in srgb, var(--text) 42%, transparent)' }}>["exact", "phonetic"]</span></p>
            <p className="ms-4" style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>{'}'}</p>
            <p style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>{'}'}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
