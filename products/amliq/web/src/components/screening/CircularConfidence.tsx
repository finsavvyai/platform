import React from 'react';

interface Props {
  score: number;
  size?: number;
}

export function CircularConfidence({ score, size = 56 }: Props) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const strokeColor = score >= 80 ? '#FF453A'
    : score >= 60 ? '#FF9F0A'
    : '#30D158';

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--dash-border)" strokeWidth={3}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={strokeColor} strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold" style={{ color: 'var(--dash-text)' }}>
        {score.toFixed(0)}%
      </span>
    </div>
  );
}
