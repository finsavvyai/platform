'use client';

import { motion } from 'framer-motion';
import { Shield, Globe, Activity, Zap } from 'lucide-react';

interface ThreatStats {
  events24h: number;
  events7d: number;
  events30d: number;
  threatsBlocked: number;
  uniqueCountries: number;
}

interface ThreatStatsBarProps {
  stats: ThreatStats;
}

const CARDS = [
  { key: 'events24h', label: 'Events (24h)', icon: Activity, color: 'text-signal' },
  { key: 'events7d', label: 'Events (7d)', icon: Zap, color: 'text-amber-400' },
  { key: 'threatsBlocked', label: 'Threats Blocked', icon: Shield, color: 'text-red-400' },
  { key: 'uniqueCountries', label: 'Countries', icon: Globe, color: 'text-green-400' },
] as const;

export function ThreatStatsBar({ stats }: ThreatStatsBarProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, color }, i) => (
        <motion.div
          key={key}
          className="rounded border border-border bg-panel/30 p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="flex items-center gap-2 text-sm text-text-secondary mb-2">
            <Icon className={`h-4 w-4 ${color}`} />
            {label}
          </div>
          <motion.p
            className="text-3xl font-bold"
            key={stats[key]}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {stats[key].toLocaleString()}
          </motion.p>
        </motion.div>
      ))}
    </div>
  );
}
