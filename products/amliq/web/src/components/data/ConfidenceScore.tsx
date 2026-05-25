import React from 'react';
import clsx from 'clsx';

interface ConfidenceScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function ConfidenceScore({ score, size = 'md' }: ConfidenceScoreProps) {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-500/20';
    if (s >= 60) return 'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-500/20';
    return 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-500/20';
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  };

  return (
    <div className={clsx('rounded-full font-semibold inline-block', getColor(score), sizes[size])}>
      {score.toFixed(0)}%
    </div>
  );
}
