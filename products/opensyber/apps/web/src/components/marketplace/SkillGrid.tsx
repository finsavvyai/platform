'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

export function SkillGrid({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function SkillCard({ children }: { children: ReactNode }) {
  return (
    <motion.div
      variants={item}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="rounded-2xl border border-border bg-panel p-6 hover:border-signal/20 hover:shadow-lg hover:shadow-signal/5 transition-all duration-300 group"
    >
      {children}
    </motion.div>
  );
}
