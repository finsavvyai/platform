import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number;
  description?: string;
  color?: 'blue' | 'green' | 'red' | 'orange';
  index?: number;
}

const dotColor: Record<string, string> = {
  blue: 'bg-[#C9A96E]',
  green: 'bg-[#2D7A4F]',
  orange: 'bg-[#B7791F]',
  red: 'bg-[#C0392B]',
};

export function StatCard({ title, value, trend, description, color = 'blue', index = 0 }: StatCardProps) {
  const trendDir = trend !== undefined ? (trend > 0 ? 'up' : 'down') : null;

  return (
    <motion.div
      className="boutique-card p-5"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em]"
          style={{ color: 'var(--dash-text-tertiary)' }}>{title}</p>
        <motion.div
          className={clsx('w-2 h-2 rounded-full', dotColor[color])}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: index * 0.4 }}
        />
      </div>
      <motion.h3
        className="text-2xl font-bold tracking-tight mb-2"
        style={{ color: 'var(--dash-text)', letterSpacing: '-0.02em' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.06 + 0.15, duration: 0.4 }}
      >
        {value}
      </motion.h3>
      <div className="flex items-center justify-between">
        {description && <p className="text-xs" style={{ color: 'var(--dash-text-tertiary)' }}>{description}</p>}
        {trendDir && (
          <motion.div
            className={clsx('flex items-center gap-1 text-xs font-semibold',
              trendDir === 'up' ? 'text-[#2D7A4F]' : 'text-[#C0392B]')}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 + 0.2 }}
          >
            {trendDir === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>{Math.abs(trend!)}%</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
