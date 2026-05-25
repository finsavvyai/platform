'use client';

import { motion } from 'framer-motion';

interface GradeDisplayProps {
  grade: string;
}

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-green-400';
  if (grade === 'B') return 'text-signal';
  if (grade === 'C') return 'text-amber-400';
  return 'text-red-400';
}

function gradeBg(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'bg-green-500/10 border-green-500/20';
  if (grade === 'B') return 'bg-signal/10 border-info/20';
  if (grade === 'C') return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export function GradeDisplay({ grade }: GradeDisplayProps) {
  return (
    <motion.div
      className={`inline-flex items-center justify-center rounded border px-6 py-3 ${gradeBg(grade)}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 20 }}
    >
      <span className={`text-4xl font-bold ${gradeColor(grade)}`}>{grade}</span>
    </motion.div>
  );
}
