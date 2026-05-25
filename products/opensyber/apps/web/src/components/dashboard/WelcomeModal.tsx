'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Shield, Brain, X } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';

const STORAGE_KEY = 'opensyber_welcome_seen';

const benefits = [
  {
    icon: Rocket,
    label: 'Deploy in 60s',
    description: 'Launch secure AI agents instantly',
    color: 'bg-info/10 text-info',
  },
  {
    icon: Shield,
    label: 'Real-time Security',
    description: 'Monitor every agent action live',
    color: 'bg-green-500/10 text-green-400',
  },
  {
    icon: Brain,
    label: 'AI-Powered Insights',
    description: 'Automated threat detection',
    color: 'bg-purple-500/10 text-purple-400',
  },
] as const;

export function WelcomeModal() {
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true); // eslint-disable-line react-hooks/set-state-in-effect -- hydration-safe init
    }
  }, []);

  function handleDismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  const firstName = session?.user?.name?.split(' ')[0] ?? 'there';

  return (
    <Portal>
      <AnimatePresence>
        {visible && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="welcome-title"
              className="max-w-lg mx-auto mt-[15vh] bg-neutral-900 border border-neutral-800 rounded-xl p-8 relative"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ ease: [0.25, 0.1, 0.25, 1] as const }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleDismiss}
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close welcome dialog"
              >
                <X className="h-4 w-4 text-neutral-400" />
              </button>
              <h2 id="welcome-title" className="text-2xl font-bold text-white">
                Welcome to OpenSyber, {firstName}!
              </h2>
              <p className="text-sm text-neutral-400 mt-1">
                Your AI agent security platform is ready.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
                {benefits.map((b) => (
                  <div
                    key={b.label}
                    className="rounded-xl bg-neutral-800/50 p-4 text-center"
                  >
                    <div
                      className={`mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${b.color}`}
                    >
                      <b.icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-white">{b.label}</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      {b.description}
                    </p>
                  </div>
                ))}
              </div>

              <button
                onClick={handleDismiss}
                className="rounded-lg bg-info px-6 py-3 text-sm font-medium text-white w-full mt-4 hover:bg-info transition-colors"
              >
                Let&apos;s Get Started
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}
