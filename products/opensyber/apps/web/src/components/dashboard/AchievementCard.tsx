'use client';

import { motion } from 'framer-motion';
import { Lock, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface AchievementCardProps {
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
  instanceId: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  score: 'text-signal',
  defense: 'text-red-400',
  compliance: 'text-green-400',
  configuration: 'text-amber-400',
};

export function AchievementCard({
  slug,
  title,
  description,
  icon: _icon,
  category,
  earned,
  instanceId,
}: AchievementCardProps) {
  return (
    <motion.div
      className={`relative rounded border p-6 transition ${
        earned
          ? 'border-amber-500/40 bg-amber-500/5'
          : 'border-border bg-panel/30 opacity-60'
      }`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: earned ? 1 : 0.6, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Lock overlay for unearned */}
      {!earned && (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-void/40 z-10">
          <Lock className="h-8 w-8 text-text-dim" />
        </div>
      )}

      <div className={earned ? '' : 'grayscale'}>
        {/* Category badge */}
        <span className={`text-xs font-medium uppercase tracking-wider ${CATEGORY_COLORS[category] ?? 'text-text-secondary'}`}>
          {category}
        </span>

        {/* Title */}
        <h4 className="text-lg font-semibold mt-2">{title}</h4>

        {/* Description */}
        <p className="text-sm text-text-secondary mt-1">{description}</p>

        {/* Share button (earned only) */}
        {earned && (
          <Link
            href={`/achievements/${instanceId}/${slug}`}
            target="_blank"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition"
          >
            <ExternalLink className="h-3 w-3" />
            Share
          </Link>
        )}
      </div>
    </motion.div>
  );
}
