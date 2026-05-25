'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const quotes = [
  'I gave an AI sudo access and went to a standup. The standup was 45 minutes.',
  'We review every human PR. The AI? It runs shell commands unsupervised.',
  '68% of agents store API keys in plaintext. In 2026. Incredible.',
  '204 days to detect a breach. That\'s not security. That\'s denial.',
  'Your AI agent has more access than your CTO. Think about that.',
  'The Trivy attack hit 45 orgs. The ones with monitoring knew in 340ms.',
  'AI agents: full codebase access, no background check, root permissions.',
  'A session cookie. In 2026. For something with your AWS keys.',
  '847 network calls per week. Zero log checks per week. The math.',
  'Stop letting AI agents run unsupervised. It\'s free. No excuse.',
];

const INTERVAL_MS = 5000;

export function QuoteTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % quotes.length);
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="border-t border-b border-border/50 py-5 overflow-hidden">
      <div className="mx-auto max-w-4xl px-6 text-center h-10 sm:h-6 relative">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            className="font-[family-name:var(--font-mono)] text-[12px] text-text-dim italic tracking-wide absolute inset-x-0"
          >
            &ldquo;{quotes[index]}&rdquo;
          </motion.p>
        </AnimatePresence>
      </div>
    </section>
  );
}
