'use client';

import { motion } from 'framer-motion';
import { TrustScoreDemo } from './TrustScoreDemo';

const ease = [0.25, 0.1, 0.25, 1] as const;

interface Signal {
  name: string;
  points: number;
  color: string;
  barColor: string;
}

const signals: Signal[] = [
  { name: 'Signature valid', points: 40, color: 'text-ok', barColor: 'bg-ok' },
  { name: 'IP consistency', points: 15, color: 'text-info', barColor: 'bg-info' },
  { name: 'Geo consistency', points: 15, color: 'text-info', barColor: 'bg-info' },
  { name: 'Device fingerprint', points: 10, color: 'text-purple-400', barColor: 'bg-purple-500' },
  { name: 'Request velocity', points: 10, color: 'text-purple-400', barColor: 'bg-purple-500' },
  { name: 'Time pattern', points: 5, color: 'text-text-secondary', barColor: 'bg-text-secondary' },
  { name: 'Nonce freshness', points: 5, color: 'text-text-secondary', barColor: 'bg-text-secondary' },
];

const thresholds = [
  { label: 'Allow', range: '80-100', color: 'text-ok', bg: 'bg-ok/10 border-ok/30' },
  { label: 'Step-Up', range: '40-79', color: 'text-warn', bg: 'bg-warn/10 border-warn/30' },
  { label: 'Block', range: '0-39', color: 'text-alert', bg: 'bg-alert/10 border-alert/30' },
];

export function TrustScoreSection(): React.ReactElement {
  return (
    <section className="py-24 md:py-32 border-t border-border/50 bg-panel/40">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease }}
          className="text-center mb-16"
        >
          <span className="font-[family-name:var(--font-mono)] text-[11px] text-info uppercase tracking-[0.2em] mb-5 block">
            Trust Engine
          </span>
          <h2 className="font-bold text-3xl sm:text-5xl md:text-7xl tracking-tight mb-4">7-Signal Trust Score</h2>
          <p className="text-text-secondary max-w-2xl mx-auto text-lg">
            Every request is scored on 7 weighted signals. Configurable thresholds let you
            allow, challenge, or block.
          </p>
        </motion.div>

        <div className="grid gap-12 lg:grid-cols-2 items-start">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease }}
            className="space-y-4"
          >
            {signals.map((signal, i) => (
              <motion.div
                key={signal.name}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4, ease }}
                className="flex items-center gap-4"
              >
                <span className="text-sm text-text-secondary w-36 shrink-0">{signal.name}</span>
                <div className="flex-1 h-3 rounded-full bg-surface overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${signal.barColor}`}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${signal.points}%` }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.08, duration: 0.6, ease }}
                  />
                </div>
                <span className={`text-sm font-mono font-medium w-12 text-right ${signal.color}`}>
                  {signal.points}pts
                </span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.2, ease }}
            className="space-y-6"
          >
            <h3 className="text-xl font-semibold">Configurable Thresholds</h3>
            <div className="space-y-4">
              {thresholds.map((t) => (
                <div
                  key={t.label}
                  className={`rounded-2xl border ${t.bg} p-4 flex items-center justify-between`}
                >
                  <div>
                    <span className={`font-semibold ${t.color}`}>{t.label}</span>
                    <p className="text-xs text-text-secondary mt-1">
                      {t.label === 'Allow' && 'Request proceeds normally'}
                      {t.label === 'Step-Up' && 'Challenge with OTP, TOTP, or passkey'}
                      {t.label === 'Block' && 'Reject and invalidate session'}
                    </p>
                  </div>
                  <span className="font-mono text-sm text-text-secondary">{t.range}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <TrustScoreDemo />
      </div>
    </section>
  );
}
