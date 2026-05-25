'use client';

import { getLevelColor, getLevel } from './types';

interface ThreatGaugeProps {
  score: number;
  delta: number;
}

const HEX_COLORS: Record<string, string> = {
  'red-500': '#ef4444',
  'orange-500': '#f97316',
  'amber-500': '#eab308',
  'blue-500': '#3b82f6',
  'green-500': '#22c55e',
};

export function ThreatGauge({ score, delta }: ThreatGaugeProps): React.ReactElement {
  const cx = 200;
  const cy = 180;
  const r = 140;
  const colorKey = getLevelColor(score);
  const hex = HEX_COLORS[colorKey] ?? '#eab308';
  const level = getLevel(score);

  function arcPath(startDeg: number, endDeg: number, radius: number): string {
    const s = (startDeg * Math.PI) / 180;
    const e = (endDeg * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(Math.PI - s);
    const y1 = cy - radius * Math.sin(Math.PI - s);
    const x2 = cx + radius * Math.cos(Math.PI - e);
    const y2 = cy - radius * Math.sin(Math.PI - e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  }

  const zones = [
    { start: 0, end: 36, color: '#22c55e' },
    { start: 36, end: 72, color: '#3b82f6' },
    { start: 72, end: 108, color: '#eab308' },
    { start: 108, end: 144, color: '#f97316' },
    { start: 144, end: 180, color: '#ef4444' },
  ];

  const needleAngle = ((100 - score) / 100) * 180;
  const needleRad = (needleAngle * Math.PI) / 180;
  const nx = cx + (r - 20) * Math.cos(needleRad);
  const ny = cy - (r - 20) * Math.sin(needleRad);

  const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;
  const deltaColor = delta > 0 ? 'text-red-400' : delta < 0 ? 'text-green-400' : 'text-neutral-400';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '';

  return (
    <div className="flex flex-col items-center">
      <svg width={400} height={220} viewBox="0 0 400 220" className="max-w-full">
        <path d={arcPath(0, 180, r)} fill="none" stroke="#262626" strokeWidth={24} strokeLinecap="round" />
        {zones.map((z) => (
          <path key={z.start} d={arcPath(z.start, z.end, r)} fill="none"
            stroke={z.color} strokeWidth={24} strokeLinecap="butt" opacity={0.25} />
        ))}
        <path d={arcPath(0, (score / 100) * 180, r)} fill="none"
          stroke={hex} strokeWidth={24} strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e5e5e5" strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="#e5e5e5" />
        <text x={cx} y={cy - 30} textAnchor="middle" fontSize={48} fontWeight="bold" fill={hex}>
          {score}
        </text>
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={16} fill="#a3a3a3">
          {level}
        </text>
      </svg>
      <div className="flex items-center gap-2 -mt-2">
        <span className={`text-sm font-medium ${deltaColor}`}>
          {deltaLabel} vs yesterday {arrow}
        </span>
      </div>
    </div>
  );
}
