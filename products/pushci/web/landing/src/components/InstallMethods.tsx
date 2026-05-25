import { useState } from 'react'
import { useReveal } from './useReveal'
import { btnGesture, btnGestureSubtle } from '../styles/gestures'

const methods = [
  { label: 'npm', cmd: 'npm install -g pushci', note: 'Recommended — bundled binaries, no network fetch' },
  { label: 'Homebrew', cmd: 'brew install finsavvyai/tap/pushci', note: 'macOS & Linux' },
  { label: 'curl', cmd: 'curl -fsSL https://pushci.dev/install.sh | sh', note: 'Any POSIX shell' },
  { label: 'npx', cmd: 'npx pushci init', note: 'No install needed — one-shot' },
]

export function InstallMethods() {
  const [active, setActive] = useState(0)
  const [copied, setCopied] = useState(false)
  const ref = useReveal()

  const copy = () => {
    navigator.clipboard.writeText(methods[active].cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section ref={ref} className="reveal py-20 sm:py-28 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-t1">
          Install your way
        </h2>
        <p className="mt-3 text-t2 max-w-lg">
          Four ways to get PushCI. Pick whatever you already have.
        </p>

        <div className="mt-10 flex flex-wrap gap-2">
          {methods.map((m, i) => (
            <button
              key={m.label}
              onClick={() => setActive(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${btnGesture} ${
                active === i
                  ? 'bg-accent text-root'
                  : 'bg-surface border border-border-base text-t2 hover:border-border-em'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-lg bg-surface border border-border-base p-5">
          <div className="flex items-center justify-between gap-4">
            <code className="font-mono text-sm text-t1 break-all">
              <span className="text-t3">$ </span>{methods[active].cmd}
            </code>
            <button onClick={copy} className={`text-t3 hover:text-t1 shrink-0 ${btnGestureSubtle}`} aria-label="Copy">
              {copied ? (
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              )}
            </button>
          </div>
          <p className="mt-2 text-caption text-t3">{methods[active].note}</p>
        </div>

        <p className="mt-6 text-body text-t3">
          Something not working?{' '}
          <code className="text-t2 bg-surface px-1.5 py-0.5 rounded text-sm">pushci troubleshoot</code>
          {' '}tells you exactly what to fix.
        </p>
      </div>
    </section>
  )
}
