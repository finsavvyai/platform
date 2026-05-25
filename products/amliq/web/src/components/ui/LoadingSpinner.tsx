interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const config = {
  sm: { r: 8, svg: 20, stroke: 2, dash: '12 24' },
  md: { r: 14, svg: 36, stroke: 2.5, dash: '22 56' },
  lg: { r: 20, svg: 48, stroke: 3, dash: '32 88' },
}

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const c = config[size]
  const center = c.svg / 2

  return (
    <div role="status" aria-label="Loading" className="flex flex-col items-center gap-3">
      <svg width={c.svg} height={c.svg} viewBox={`0 0 ${c.svg} ${c.svg}`} fill="none">
        <circle
          cx={center} cy={center} r={c.r}
          stroke="rgba(201,169,110,0.15)"
          strokeWidth={c.stroke}
        />
        <circle
          cx={center} cy={center} r={c.r}
          stroke="#C9A96E"
          strokeWidth={c.stroke}
          strokeLinecap="round"
          strokeDasharray={c.dash}
          style={{ animation: 'spin 0.9s linear infinite', transformOrigin: 'center' }}
        />
      </svg>
      {size !== 'sm' && (
        <div className="flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: size === 'lg' ? 6 : 4,
                height: size === 'lg' ? 6 : 4,
                background: '#C9A96E',
                opacity: 0.7,
                animation: `bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
