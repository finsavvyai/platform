const cols = Array.from({ length: 20 }, (_, i) => i)
const chars = '01AMLIQ$%#@!&OFAC'

function getChar(col: number) {
  return chars[(col * 7 + 3) % chars.length]
}

export default function DataRain() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="relative w-full h-full">
        {cols.map(i => (
          <div
            key={i}
            className="absolute top-0 text-xs font-mono whitespace-pre leading-5"
            style={{
              left: `${(i / cols.length) * 100}%`,
              color: i % 3 === 0 ? 'var(--accent-gold)' : '#4F46E5',
              opacity: 0.04,
              animation: `rain ${8 + (i % 5) * 2}s linear infinite`,
              animationDelay: `${-(i % 7) * 1.2}s`,
            }}
          >
            {Array.from({ length: 30 }, (_, j) => getChar(i + j)).join('\n')}
          </div>
        ))}
      </div>
    </div>
  )
}
