import { useEffect, useState } from 'react'

const lines = [
  { text: '$ npx pushci init', delay: 0, color: 'text-emerald-400' },
  { text: '', delay: 600, color: '' },
  { text: 'Scanning repository...', delay: 800, color: 'text-zinc-400' },
  { text: 'Detected: Next.js 14 + TypeScript + Tailwind', delay: 1600, color: 'text-zinc-300' },
  { text: 'Detected: PostgreSQL + Prisma ORM', delay: 2200, color: 'text-zinc-300' },
  { text: 'Detected: Jest + Playwright tests', delay: 2800, color: 'text-zinc-300' },
  { text: '', delay: 3200, color: '' },
  { text: 'Generated pipeline: build -> test -> deploy', delay: 3600, color: 'text-emerald-400' },
  { text: '', delay: 4000, color: '' },
  { text: 'Running tests...', delay: 4200, color: 'text-zinc-400' },
  { text: '  23 passed, 0 failed', delay: 5000, color: 'text-emerald-400' },
  { text: '', delay: 5400, color: '' },
  { text: 'Ready to deploy. Push to trigger.', delay: 5800, color: 'text-emerald-300 font-medium' },
]

export function TerminalDemo() {
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    if (visible >= lines.length) return
    const timer = setTimeout(
      () => setVisible((v) => v + 1),
      lines[visible]?.delay - (lines[visible - 1]?.delay ?? 0) || 400
    )
    return () => clearTimeout(timer)
  }, [visible])

  return (
    <div className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-red-500/80" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
        <span className="h-3 w-3 rounded-full bg-green-500/80" />
        <span className="ml-2 text-xs text-zinc-500 font-mono">terminal</span>
      </div>
      <div className="p-4 font-mono text-sm leading-relaxed h-72 overflow-hidden">
        {lines.slice(0, visible).map((line, i) => (
          <div key={i} className={line.color || 'text-zinc-500'}>
            {line.text || '\u00A0'}
          </div>
        ))}
        {visible < lines.length && (
          <span className="inline-block w-2 h-4 bg-emerald-400 cursor-blink" />
        )}
      </div>
    </div>
  )
}
