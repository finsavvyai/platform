import React from 'react';

interface KPIProgressRingProps {
  label: string;
  value: number;
  target: number;
  unit?: string;
  color?: string;
}

const RADIUS = 42;
const STROKE = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = (RADIUS + STROKE) * 2;

export function KPIProgressRing({
  label,
  value,
  target,
  unit = '',
  color = '#C9A96E',
}: KPIProgressRingProps) {
  const ratio = Math.min(value / Math.max(target, 1), 1);
  const dashOffset = CIRCUMFERENCE * (1 - ratio);
  const achieved = value >= target;

  return (
    <div
      className="flex flex-col items-center gap-2"
      style={
        achieved
          ? { filter: `drop-shadow(0 0 20px ${color}4D)` }
          : undefined
      }
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${label}: ${value}${unit} of ${target}${unit}`}
      >
        {/* Track */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-white/10"
        />
        {/* Fill */}
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        {/* Center text */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="15"
          fontWeight="700"
          fill={color}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {value}{unit}
        </text>
      </svg>

      <p
        className="text-xs font-semibold uppercase tracking-widest text-center"
        style={{ color: 'var(--dash-text-secondary)' }}
      >
        {label}
      </p>
      <p className="text-xs text-center" style={{ color: 'var(--dash-text-tertiary)' }}>
        {value}{unit} of {target}{unit} target
      </p>
    </div>
  );
}
