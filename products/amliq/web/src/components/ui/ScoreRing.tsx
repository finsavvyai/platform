import React from 'react'

interface ScoreRingProps {
  score: number
  size?: number
  strokeWidth?: number
}

export function ScoreRing({ score, size = 64, strokeWidth = 4 }: ScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const center = size / 2

  const color = score >= 80 ? '#FF453A' : score >= 60 ? '#FF9F0A' : '#30D158'
  const colorEnd = score >= 80 ? '#EC4899' : score >= 60 ? '#2563EB' : '#00B894'
  const glowId = `glow-${score}`
  const gradId = `grad-${score}`

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={colorEnd} />
          </linearGradient>
          <filter id={glowId}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={center} cy={center} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={center} cy={center} r={radius}
          fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          filter={`url(#${glowId})`}
          className="transition-all duration-1000 ease-out" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold"
        style={{ color: 'var(--dash-text)' }}>
        {score}%
      </span>
    </div>
  )
}
