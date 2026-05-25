'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PartyPopper, ShieldCheck } from 'lucide-react';

const CONFETTI_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
];

export function StepCelebration({ onFinish }: { onFinish: () => void }) {
  const [loading, setLoading] = useState(false);

  /* eslint-disable react-hooks/purity -- one-time random init for confetti positions */
  const confettiAnimations = useMemo(
    () =>
      Array.from({ length: 12 }, () => ({
        x: (Math.random() - 0.5) * 300,
        peakY: -120 - Math.random() * 80,
      })),
    [],
  );
  /* eslint-enable react-hooks/purity */

  async function handleFinish() {
    setLoading(true);
    try {
      await fetch('/api/proxy/user/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismiss: true }),
      });
    } catch {
      // Best-effort — still redirect to dashboard even if PATCH fails
    }
    onFinish();
  }

  return (
    <div className="flex flex-col items-center text-center relative overflow-hidden py-4">
      {confettiAnimations.map((anim, i) => (
        <motion.div
          key={i}
          className="absolute h-3 w-3 rounded-full"
          style={{
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{
            x: anim.x,
            y: [0, anim.peakY, 200],
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 1.6, delay: i * 0.08, ease: 'easeOut' }}
        />
      ))}
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-400 mb-4">
        <PartyPopper className="h-6 w-6" />
      </div>
      <h3 className="text-3xl font-bold text-white">
        You&apos;re All Set!
      </h3>
      <p className="text-sm text-neutral-400 mt-2">
        Your AI agent security platform is configured.
      </p>
      <div className="rounded-xl bg-info/10 border border-info/20 px-6 py-4 mt-6 w-full max-w-xs">
        <ShieldCheck className="h-8 w-8 text-info mx-auto mb-2" />
        <p className="text-sm font-medium text-white">
          Agent Connected
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          You&apos;ll see your activity in the dashboard
        </p>
      </div>
      <button
        onClick={handleFinish}
        disabled={loading}
        className="w-full max-w-sm rounded-lg bg-info px-6 py-3 text-sm font-medium text-white hover:bg-info transition-colors mt-6 disabled:opacity-50"
      >
        {loading ? 'Finishing...' : 'Go to Dashboard'}
      </button>
    </div>
  );
}
