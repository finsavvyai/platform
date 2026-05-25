'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export function PricingGrid({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function PricingRow({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="mt-5 grid gap-5 md:grid-cols-2"
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function PricingCard({
  children,
  popular,
}: {
  children: ReactNode;
  popular?: boolean;
}) {
  return (
    <motion.div
      variants={item}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
      className={`relative rounded-2xl p-8 transition-all duration-300 ${
        popular
          ? 'border border-signal/30 bg-signal/[0.03] glow-signal-sm'
          : 'border border-border bg-panel'
      }`}
    >
      {children}
    </motion.div>
  );
}
