import { useState, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, Shield, Globe, Check } from 'lucide-react';
import { HeroBg } from '../../components/marketing/HeroBg';
import { HeroScreeningCard } from '../../components/marketing/HeroScreeningCard';
import { submitDemoLead } from '../../lib/supabase';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export default function HeroSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    const { error } = await submitDemoLead({ email, source: 'hero' });
    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
      return;
    }
    setStatus('ok');
    setEmail('');
  }

  return (
    <section className="relative min-h-[94vh] flex items-center pt-20 pb-24 px-4 overflow-hidden">
      <HeroBg />
      <div className="relative max-w-6xl mx-auto w-full">
        <div className="grid lg:grid-cols-[1fr_1.1fr] gap-14 lg:gap-20 items-center">
          <div>
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold mb-7"
              style={{ background: 'var(--accent-gold-light)', borderColor: 'color-mix(in srgb, var(--accent-gold) 22%, transparent)', color: 'var(--accent-gold)' }}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <motion.span
                className="w-1.5 h-1.5 rounded-full bg-[#C9A96E]"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              Compliance infrastructure for payments
            </motion.div>

            <motion.h1
              className="text-[2.6rem] sm:text-5xl lg:text-[3.4rem] font-bold leading-[1.06] mb-6"
              style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}
              variants={fadeUp} initial="initial" animate="animate"
              transition={{ duration: 0.55, delay: 0.1 }}
            >
              Real-time sanctions screening for{' '}
              <span style={{
                background: 'linear-gradient(135deg, #C9A96E 0%, #E8D5A3 50%, #B8945A 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
                high-volume payment systems
              </span>
            </motion.h1>

            <motion.p
              className="text-lg leading-relaxed mb-6 max-w-[560px]"
              style={{ color: 'color-mix(in srgb, var(--text) 62%, transparent)' }}
              variants={fadeUp} initial="initial" animate="animate"
              transition={{ duration: 0.5, delay: 0.22 }}
            >
              A sub-50ms decision engine for mission-critical compliance. Reduce
              false positives, increase approval rates, and keep full audit trails
              across every transaction, customer, and counterparty.
            </motion.p>

            <motion.ul
              className="flex flex-wrap gap-x-6 gap-y-2 mb-8 text-sm"
              style={{ color: 'color-mix(in srgb, var(--text) 72%, transparent)' }}
              variants={fadeUp} initial="initial" animate="animate"
              transition={{ duration: 0.5, delay: 0.28 }}
            >
              {['OFAC, EU, UN, HMT & 200+ lists', 'Explainable matching', 'SOC 2 & GDPR aligned'].map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4" style={{ color: 'var(--accent-gold)' }} />
                  {item}
                </li>
              ))}
            </motion.ul>

            <motion.form
              onSubmit={onSubmit}
              className="flex flex-wrap items-center gap-3 mb-5 max-w-[560px]"
              variants={fadeUp} initial="initial" animate="animate"
              transition={{ duration: 0.5, delay: 0.32 }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="flex-1 min-w-[220px] px-4 py-3 text-sm rounded-[10px] outline-none"
                style={{
                  background: 'color-mix(in srgb, var(--text) 4%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--text) 12%, transparent)',
                  color: 'var(--text)',
                }}
                disabled={status === 'loading' || status === 'ok'}
              />
              <motion.button
                type="submit"
                disabled={status === 'loading' || status === 'ok'}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-[10px] disabled:opacity-60"
                style={{ background: 'var(--accent-gold)', color: '#0A0908' }}
                whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(201,169,110,0.38)' }}
                whileTap={{ scale: 0.97 }}
              >
                {status === 'ok' ? 'Request received' : 'Start screening'} <ArrowRight className="w-4 h-4" />
              </motion.button>
              <motion.a
                href="https://calendly.com/amliq"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-[10px]"
                style={{ background: 'color-mix(in srgb, var(--text) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--text) 10%, transparent)', color: 'color-mix(in srgb, var(--text) 78%, transparent)' }}
                whileHover={{ y: -2, background: 'color-mix(in srgb, var(--text) 10%, transparent)' }}
                whileTap={{ scale: 0.97 }}
              >
                Book demo
              </motion.a>
            </motion.form>

            <div className="min-h-[20px] mb-10 text-xs" aria-live="polite">
              {status === 'ok' && (
                <span style={{ color: '#6FCF97' }}>Thanks. Our team will reach out within one business day.</span>
              )}
              {status === 'error' && (
                <span style={{ color: '#EB5757' }}>{errorMsg || 'Something went wrong. Please try again.'}</span>
              )}
              {status === 'idle' && (
                <span style={{ color: 'color-mix(in srgb, var(--text) 38%, transparent)' }}>
                  No credit card. Sandbox access within one business day.
                </span>
              )}
            </div>

            <motion.div
              className="flex flex-wrap items-center gap-5"
              variants={fadeUp} initial="initial" animate="animate"
              transition={{ duration: 0.5, delay: 0.42 }}
            >
              {[
                { icon: Zap, value: '<50ms', label: 'P99 decision latency' },
                { icon: Shield, value: '200+', label: 'Sanctions & PEP lists' },
                { icon: Globe, value: '99.97%', label: 'Uptime SLA' },
              ].map(({ icon: Icon, value, label }, i) => (
                <div key={label} className="flex items-center gap-2.5">
                  {i > 0 && <div className="w-px h-8" style={{ background: 'color-mix(in srgb, var(--text) 8%, transparent)' }} />}
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-gold-light)' }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: 'var(--accent-gold)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-none" style={{ color: 'var(--text)' }}>{value}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: 'color-mix(in srgb, var(--text) 38%, transparent)' }}>{label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <HeroScreeningCard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
