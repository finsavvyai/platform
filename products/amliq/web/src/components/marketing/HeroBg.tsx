import { motion } from 'framer-motion';

export function HeroBg() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, var(--bg) 0%, var(--bg-secondary) 50%, #0D0B09 100%)' }} />
      <div className="absolute inset-0 opacity-[0.022]" style={{
        backgroundImage: `linear-gradient(color-mix(in srgb, var(--accent-gold) 50%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--accent-gold) 50%, transparent) 1px, transparent 1px)`,
        backgroundSize: '64px 64px',
      }} />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 700, height: 700, top: '-20%', right: '-15%', background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-gold) 11%, transparent) 0%, transparent 60%)' }}
        animate={{ scale: [1, 1.07, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute rounded-full"
        style={{ width: 450, height: 450, bottom: '-10%', left: '-8%', background: 'radial-gradient(circle, rgba(45,122,79,0.09) 0%, transparent 65%)' }}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <div className="absolute inset-x-0 bottom-0 h-32" style={{ background: 'linear-gradient(to bottom, transparent, var(--bg))' }} />
    </div>
  );
}
