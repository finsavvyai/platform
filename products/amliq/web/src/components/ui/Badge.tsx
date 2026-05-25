import React from 'react';
import clsx from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'green' | 'red' | 'orange' | 'blue' | 'purple' | 'gray';
  size?: 'sm' | 'md';
}

const colors = {
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400',
  orange: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  blue: 'bg-[rgba(26,24,20,0.08)] text-[#1A1814] dark:bg-[rgba(201,169,110,0.12)] dark:text-[#C9A96E]',
  purple: 'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300',
  gray: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400',
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs font-medium',
  md: 'px-2.5 py-0.5 text-xs font-medium',
};

export function Badge({ children, color = 'blue', size = 'md' }: BadgeProps) {
  return (
    <span className={clsx('rounded-full inline-block', colors[color], sizes[size])}>
      {children}
    </span>
  );
}
