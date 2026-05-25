import { useEffect, useState } from 'react'

function TopBar() {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t1 = setTimeout(() => setWidth(30), 50)
    const t2 = setTimeout(() => setWidth(60), 400)
    const t3 = setTimeout(() => setWidth(80), 900)
    const t4 = setTimeout(() => setWidth(95), 1800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px]" style={{ background: 'rgba(201,169,110,0.12)' }}>
      <div
        className="h-full transition-all ease-out"
        style={{
          width: `${width}%`,
          background: 'linear-gradient(90deg, #C9A96E, #E8C98A, #C9A96E)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s linear infinite',
          boxShadow: '0 0 12px 2px rgba(201,169,110,0.5)',
          transitionDuration: width === 30 ? '0.3s' : width === 60 ? '0.5s' : width === 80 ? '0.8s' : '1.5s',
        }}
      />
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center" style={{ background: 'var(--dash-bg, #0F0E0C)' }}>
      <TopBar />
      <div className="flex flex-col items-center gap-8">
        <div className="relative">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="rgba(201,169,110,0.15)" strokeWidth="3" />
            <circle
              cx="24" cy="24" r="20"
              stroke="#C9A96E"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="40 86"
              style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full" style={{ background: '#C9A96E', animation: 'pulse 1s ease-in-out infinite' }} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#C9A96E',
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function SectionLoader({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center py-16 ${className}`}>
      <div className="flex flex-col items-center gap-4">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="14" stroke="rgba(201,169,110,0.15)" strokeWidth="2.5" />
          <circle
            cx="18" cy="18" r="14"
            stroke="#C9A96E"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="28 60"
            style={{ animation: 'spin 0.9s linear infinite', transformOrigin: 'center' }}
          />
        </svg>
        <div className="flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1 h-1 rounded-full"
              style={{
                background: '#C9A96E',
                opacity: 0.7,
                animation: `bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
