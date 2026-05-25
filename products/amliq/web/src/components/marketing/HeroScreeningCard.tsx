import { motion } from 'framer-motion';

export function HeroScreeningCard() {
  return (
    <div className="relative select-none">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          border: '1px solid color-mix(in srgb, var(--accent-gold) 14%, transparent)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
          background: '#0E0D0B',
        }}
      >
        <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: '1px solid color-mix(in srgb, var(--text) 6%, transparent)', background: 'rgba(255,255,255,0.02)' }}>
          <span className="w-3 h-3 rounded-full bg-[#2E2B27]" />
          <span className="w-3 h-3 rounded-full bg-[#2E2B27]" />
          <span className="w-3 h-3 rounded-full bg-[#2E2B27]" />
          <span className="ms-2 text-xs font-mono" style={{ color: 'color-mix(in srgb, var(--text) 28%, transparent)' }}>POST /v1/screen</span>
          <motion.span
            className="ms-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(45,122,79,0.12)', color: '#3DAA6A', border: '1px solid rgba(45,122,79,0.18)' }}
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            Live
          </motion.span>
        </div>

        <div className="p-5 font-mono text-sm leading-[1.9]">
          <p style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>{'{'}</p>
          <p className="ms-4"><span style={{ color: 'var(--accent-gold)' }}>"entity"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: '#3DAA6A' }}>"Hassan Ali Mohammad"</span>,</p>
          <p className="ms-4"><span style={{ color: 'var(--accent-gold)' }}>"lists"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: 'color-mix(in srgb, var(--text) 42%, transparent)' }}>["OFAC", "UN", "EU", "UK_OFSI"]</span>,</p>
          <p className="ms-4"><span style={{ color: 'var(--accent-gold)' }}>"threshold"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: '#E8D5A3' }}>0.75</span></p>
          <p style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>{'}'}</p>
        </div>

        <div className="p-5 font-mono text-sm leading-[1.9]" style={{ borderTop: '1px solid rgba(45,122,79,0.12)', background: 'rgba(45,122,79,0.03)' }}>
          <p className="mb-1" style={{ color: 'color-mix(in srgb, var(--text) 20%, transparent)' }}>{'// Response — 0.8ms'}</p>
          <p style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>{'{'}</p>
          <p className="ms-4"><span style={{ color: 'var(--accent-gold)' }}>"matches"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: 'var(--text)' }}>2</span>,</p>
          <p className="ms-4"><span style={{ color: 'var(--accent-gold)' }}>"score"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: 'var(--accent-gold)' }}>0.94</span>,</p>
          <p className="ms-4"><span style={{ color: 'var(--accent-gold)' }}>"list"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: '#3DAA6A' }}>"OFAC SDN"</span>,</p>
          <p className="ms-4"><span style={{ color: 'var(--accent-gold)' }}>"explanation"</span><span style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>: </span><span style={{ color: '#3DAA6A' }}>"Exact + phonetic match"</span></p>
          <p style={{ color: 'color-mix(in srgb, var(--text) 25%, transparent)' }}>{'}'}</p>
        </div>
      </div>

      <motion.div
        className="absolute -bottom-5 -end-5 w-28 h-28 rounded-2xl flex flex-col items-center justify-center text-center"
        style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-gold) 15%, transparent), color-mix(in srgb, var(--accent-gold) 4%, transparent))', border: '1px solid color-mix(in srgb, var(--accent-gold) 18%, transparent)', backdropFilter: 'blur(16px)' }}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.85, type: 'spring', stiffness: 180 }}
      >
        <p className="text-2xl font-bold" style={{ color: 'var(--accent-gold)' }}>94%</p>
        <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'color-mix(in srgb, var(--text) 45%, transparent)' }}>Confidence</p>
      </motion.div>

      <motion.div
        className="absolute -top-5 -start-5 px-3 py-2 rounded-xl flex items-center gap-2"
        style={{ background: 'rgba(45,122,79,0.1)', border: '1px solid rgba(45,122,79,0.22)', backdropFilter: 'blur(16px)' }}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
      >
        <motion.span
          className="w-2 h-2 rounded-full bg-[#3DAA6A]"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-xs font-semibold" style={{ color: '#3DAA6A' }}>OFAC SDN matched</span>
      </motion.div>
    </div>
  );
}
