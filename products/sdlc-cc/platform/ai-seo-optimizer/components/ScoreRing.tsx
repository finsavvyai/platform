import { memo } from 'react';
import { motion } from 'framer-motion';

interface ScoreRingProps {
  score: number;
  size?: number;
  label?: string;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return { stroke: '#10B981', bg: 'rgba(16, 185, 129, 0.08)' };
  if (score >= 50) return { stroke: '#F59E0B', bg: 'rgba(245, 158, 11, 0.08)' };
  return { stroke: '#EF4444', bg: 'rgba(239, 68, 68, 0.08)' };
};

export const ScoreRing: React.FC<ScoreRingProps> = memo(({ score, size = 120, label }) => {
  const { stroke, bg } = getScoreColor(score);
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const center = size / 2;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="score-ring">
          <circle
            cx={center} cy={center} r={radius}
            fill={bg}
            stroke="#E2E8F0"
            strokeWidth="6"
          />
          <motion.circle
            cx={center} cy={center} r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            whileInView={{ strokeDashoffset: offset }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center rotate-0">
          <span className="text-2xl font-bold text-slate-900">{score}</span>
        </div>
      </div>
      {label && (
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          {label}
        </span>
      )}
    </div>
  );
});

ScoreRing.displayName = 'ScoreRing';
