import { motion } from 'framer-motion';

const lists = [
  'OFAC SDN', 'UN Security Council', 'EU Consolidated', 'UK OFSI', 'FATF',
  'PEP Tier 1', 'Interpol', 'World Bank', 'SECO', 'AUSTRAC', 'FinCEN',
  'OFAC SDN', 'UN Security Council', 'EU Consolidated', 'UK OFSI', 'FATF',
  'PEP Tier 1', 'Interpol', 'World Bank', 'SECO', 'AUSTRAC', 'FinCEN',
];

export default function TrustStrip() {
  return (
    <div className="relative overflow-hidden py-5" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--accent-gold-light)' }}>
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.18em] mb-4" style={{ color: 'color-mix(in srgb, var(--accent-gold) 50%, transparent)' }}>
        Screening against 200+ global sanctions &amp; watchlists
      </p>

      <div className="relative overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 w-20 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to right, var(--bg), transparent)' }}
        />
        <div
          className="absolute inset-y-0 right-0 w-20 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to left, var(--bg), transparent)' }}
        />

        <motion.div
          className="flex gap-6 whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
        >
          {lists.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold shrink-0"
              style={{ background: 'color-mix(in srgb, var(--accent-gold) 6%, transparent)', border: '1px solid var(--accent-gold-light)', color: 'color-mix(in srgb, var(--text) 50%, transparent)' }}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'color-mix(in srgb, var(--accent-gold) 50%, transparent)' }} />
              {name}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
