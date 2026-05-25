import { useMemo } from 'react';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function ConfettiDots() {
  const reduced = prefersReducedMotion();

  const dots = useMemo(() => {
    if (reduced) return [];
    return Array.from({ length: 24 }).map((_, i) => {
      const size = 4 + Math.random() * 6;
      const left = Math.random() * 100;
      const delay = Math.random() * 1.5;
      const duration = 1.5 + Math.random() * 1.5;
      const hue = [142, 160, 200, 280, 45, 0][i % 6];
      return { size, left, delay, duration, hue, key: i };
    });
  }, [reduced]);

  if (reduced) return null;

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(180px) rotate(360deg); }
        }
      `}</style>
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        {dots.map((d) => (
          <span
            key={d.key}
            className="absolute rounded-full opacity-0"
            style={{
              width: d.size,
              height: d.size,
              left: `${d.left}%`,
              top: '-8px',
              backgroundColor: `hsl(${d.hue}, 70%, 60%)`,
              animation: `confetti-fall ${d.duration}s ${d.delay}s ease-out forwards`,
            }}
          />
        ))}
      </div>
    </>
  );
}
