import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Calendar, BookOpen } from 'lucide-react';

export default function CTASection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section ref={ref} className="relative py-24 sm:py-32 px-4 overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(61,170,106,0.08) 0%, transparent 55%), radial-gradient(circle at 80% 20%, rgba(201,169,110,0.1) 0%, transparent 55%)' }} />
      <div className="absolute top-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.4), transparent)' }} />
      <div className="absolute bottom-0 inset-x-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(61,170,106,0.25), transparent)' }} />

      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(201,169,110,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,0.04) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
      }} />

      <div className="relative max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8 text-xs font-semibold tracking-widest uppercase"
            style={{ background: 'var(--accent-gold-light)', border: '1px solid color-mix(in srgb, var(--accent-gold) 25%, transparent)', color: 'var(--accent-gold)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#C9A96E] animate-pulse" />
            Get started today
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6" style={{ color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.08 }}>
            Start screening in minutes.{' '}
            <span style={{
              background: 'linear-gradient(135deg, #C9A96E 0%, #E8CC97 50%, #C9A96E 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Stay compliant for years.
            </span>
          </h2>

          <p className="text-lg mb-12 max-w-xl mx-auto leading-relaxed" style={{ color: 'color-mix(in srgb, var(--text) 55%, transparent)' }}>
            One API for sanctions, PEP, adverse media, and transaction screening.
            Reduce false positives, keep audit trails, and go from sandbox to live in under an hour.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.a
              href="https://calendly.com/amliq"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 text-sm font-semibold rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #C9A96E, #B8935A)',
                color: '#1A1814',
                boxShadow: '0 0 0 1px rgba(201,169,110,0.3), 0 8px 32px rgba(201,169,110,0.25)',
              }}
              whileHover={{
                y: -2,
                boxShadow: '0 0 0 1px rgba(201,169,110,0.5), 0 16px 48px rgba(201,169,110,0.35)',
              }}
              whileTap={{ scale: 0.97, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Calendar className="w-4 h-4" />
              Book demo
              <ArrowRight className="w-4 h-4" />
            </motion.a>

            <motion.a
              href="/docs"
              className="inline-flex items-center justify-center gap-2.5 px-8 py-4 text-sm font-semibold rounded-xl"
              style={{
                background: 'color-mix(in srgb, var(--text) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--text) 12%, transparent)',
                color: 'color-mix(in srgb, var(--text) 75%, transparent)',
              }}
              whileHover={{
                y: -2,
                background: 'rgba(250,250,248,0.1)',
                border: '1px solid rgba(250,250,248,0.2)',
                color: '#FAFAF8',
              }}
              whileTap={{ scale: 0.97, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <BookOpen className="w-4 h-4" />
              Get API access
            </motion.a>
          </div>

          <motion.div
            className="mt-14 pt-10 flex flex-col sm:flex-row items-center justify-center gap-8"
            style={{ borderTop: '1px solid color-mix(in srgb, var(--text) 8%, transparent)' }}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            {[
              { label: 'No credit card required', dot: '#3DAA6A' },
              { label: 'Sandbox access in minutes', dot: 'var(--accent-gold)' },
              { label: 'Dedicated onboarding support', dot: '#3DAA6A' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2 text-sm" style={{ color: 'color-mix(in srgb, var(--text) 45%, transparent)' }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.dot }} />
                {item.label}
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
