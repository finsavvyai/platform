import { useEffect, useState, useCallback } from 'react'

interface Line {
  text: string
  delay: number
  style?: string
}

const stacks: Record<string, Line[]> = {
  'Next.js': [
    { text: '$ npx pushci init', delay: 0, style: 'text-t1' },
    { text: '', delay: 400 },
    { text: 'Scanning repository...', delay: 600, style: 'text-t3' },
    { text: '  Found: Next.js 14 · TypeScript · Tailwind', delay: 1200, style: 'text-t2' },
    { text: '  Found: PostgreSQL · Prisma ORM', delay: 1700, style: 'text-t2' },
    { text: '  Found: Jest · Playwright', delay: 2100, style: 'text-t2' },
    { text: '', delay: 2400 },
    { text: '> Pipeline generated: build > test > deploy', delay: 2700, style: 'text-accent' },
    { text: '', delay: 2900 },
    { text: '$ pushci run', delay: 3200, style: 'text-t1' },
    { text: '  > build    1.2s', delay: 3700, style: 'text-accent' },
    { text: '  > test     2.1s  (23 passed)', delay: 4200, style: 'text-accent' },
    { text: '  > lint     0.8s', delay: 4500, style: 'text-accent' },
    { text: '', delay: 4700 },
    { text: 'All checks passed. Ready to push.', delay: 5000, style: 'text-t2' },
  ],
  'Django': [
    { text: '$ npx pushci init', delay: 0, style: 'text-t1' },
    { text: '', delay: 400 },
    { text: 'Scanning repository...', delay: 600, style: 'text-t3' },
    { text: '  Found: Django 5.0 · Python 3.12', delay: 1200, style: 'text-t2' },
    { text: '  Found: PostgreSQL · Redis · Celery', delay: 1700, style: 'text-t2' },
    { text: '  Found: pytest · coverage', delay: 2100, style: 'text-t2' },
    { text: '', delay: 2400 },
    { text: '> Pipeline generated: migrate > test > deploy', delay: 2700, style: 'text-accent' },
    { text: '', delay: 2900 },
    { text: '$ pushci run', delay: 3200, style: 'text-t1' },
    { text: '  > migrate  0.4s', delay: 3700, style: 'text-accent' },
    { text: '  > test     3.2s  (87 passed)', delay: 4200, style: 'text-accent' },
    { text: '  > lint     1.1s', delay: 4500, style: 'text-accent' },
    { text: '', delay: 4700 },
    { text: 'All checks passed. Ready to push.', delay: 5000, style: 'text-t2' },
  ],
  'Go': [
    { text: '$ npx pushci init', delay: 0, style: 'text-t1' },
    { text: '', delay: 400 },
    { text: 'Scanning repository...', delay: 600, style: 'text-t3' },
    { text: '  Found: Go 1.22 · Chi router', delay: 1200, style: 'text-t2' },
    { text: '  Found: PostgreSQL · Docker', delay: 1700, style: 'text-t2' },
    { text: '  Found: go test · golangci-lint', delay: 2100, style: 'text-t2' },
    { text: '', delay: 2400 },
    { text: '> Pipeline generated: vet > test > build > deploy', delay: 2700, style: 'text-accent' },
    { text: '', delay: 2900 },
    { text: '$ pushci run', delay: 3200, style: 'text-t1' },
    { text: '  > vet      0.3s', delay: 3700, style: 'text-accent' },
    { text: '  > test     1.8s  (142 passed)', delay: 4200, style: 'text-accent' },
    { text: '  > build    2.4s', delay: 4500, style: 'text-accent' },
    { text: '', delay: 4700 },
    { text: 'All checks passed. Ready to push.', delay: 5000, style: 'text-t2' },
  ],
  'Rails': [
    { text: '$ npx pushci init', delay: 0, style: 'text-t1' },
    { text: '', delay: 400 },
    { text: 'Scanning repository...', delay: 600, style: 'text-t3' },
    { text: '  Found: Rails 7.1 · Ruby 3.3', delay: 1200, style: 'text-t2' },
    { text: '  Found: PostgreSQL · Sidekiq · Redis', delay: 1700, style: 'text-t2' },
    { text: '  Found: RSpec · Rubocop', delay: 2100, style: 'text-t2' },
    { text: '', delay: 2400 },
    { text: '> Pipeline generated: migrate > test > lint > deploy', delay: 2700, style: 'text-accent' },
    { text: '', delay: 2900 },
    { text: '$ pushci run', delay: 3200, style: 'text-t1' },
    { text: '  > migrate  0.6s', delay: 3700, style: 'text-accent' },
    { text: '  > test     4.1s  (64 passed)', delay: 4200, style: 'text-accent' },
    { text: '  > lint     1.3s', delay: 4500, style: 'text-accent' },
    { text: '', delay: 4700 },
    { text: 'All checks passed. Ready to push.', delay: 5000, style: 'text-t2' },
  ],
  'Rust': [
    { text: '$ npx pushci init', delay: 0, style: 'text-t1' },
    { text: '', delay: 400 },
    { text: 'Scanning repository...', delay: 600, style: 'text-t3' },
    { text: '  Found: Rust 1.77 · Axum', delay: 1200, style: 'text-t2' },
    { text: '  Found: SQLx · Redis', delay: 1700, style: 'text-t2' },
    { text: '  Found: cargo test · clippy', delay: 2100, style: 'text-t2' },
    { text: '', delay: 2400 },
    { text: '> Pipeline generated: clippy > test > build > deploy', delay: 2700, style: 'text-accent' },
    { text: '', delay: 2900 },
    { text: '$ pushci run', delay: 3200, style: 'text-t1' },
    { text: '  > clippy   1.1s', delay: 3700, style: 'text-accent' },
    { text: '  > test     2.7s  (38 passed)', delay: 4200, style: 'text-accent' },
    { text: '  > build    5.3s', delay: 4500, style: 'text-accent' },
    { text: '', delay: 4700 },
    { text: 'All checks passed. Ready to push.', delay: 5000, style: 'text-t2' },
  ],
}

const stackNames = Object.keys(stacks) as (keyof typeof stacks)[]

export function TerminalDemo() {
  const [activeStack, setActiveStack] = useState<string>('Next.js')
  const [visible, setVisible] = useState(0)
  const [done, setDone] = useState(false)
  const lines = stacks[activeStack]

  const restart = useCallback(() => {
    setVisible(0)
    setDone(false)
  }, [])

  const switchStack = useCallback((stack: string) => {
    setActiveStack(stack)
    setVisible(0)
    setDone(false)
  }, [])

  useEffect(() => {
    if (visible >= lines.length) {
      setDone(true)
      return
    }
    const prev = visible > 0 ? lines[visible - 1].delay : 0
    const timer = setTimeout(
      () => setVisible((v) => v + 1),
      lines[visible].delay - prev || 300
    )
    return () => clearTimeout(timer)
  }, [visible, lines])

  return (
    <div className="w-full rounded-lg border border-border-base bg-surface overflow-hidden">
      {/* Chrome bar with stack picker */}
      <div className="flex items-center justify-between border-b border-border-base/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-border-em" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-em" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-em" />
          <span className="ml-3 text-caption text-t3 font-mono">~/my-project</span>
        </div>
        <div className="flex items-center gap-1">
          {stackNames.map((name) => (
            <button
              key={name}
              onClick={() => switchStack(name)}
              className={`px-2 py-0.5 rounded text-caption font-mono transition-colors duration-150 ${
                activeStack === name
                  ? 'bg-raised text-t2'
                  : 'text-t3 hover:text-t2'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Terminal content */}
      <div className="p-4 sm:p-5 font-mono text-body leading-6 min-h-[320px] sm:min-h-[360px] relative">
        {lines.slice(0, visible).map((line, i) => (
          <div key={`${activeStack}-${i}`} className={line.style || 'text-t3'}>
            {line.text || '\u00A0'}
          </div>
        ))}
        {!done && (
          <span className="inline-block w-[7px] h-[15px] bg-t2 cursor-blink" />
        )}

        {/* Replay button */}
        {done && (
          <button
            onClick={restart}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 text-caption text-t3 hover:text-t2 transition-colors duration-200"
            aria-label="Replay demo"
          >
            <svg className="w-3.5 h-3.5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Replay
          </button>
        )}
      </div>
    </div>
  )
}
