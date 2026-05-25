import { useState } from 'react'
import { btnGesture } from '../styles/gestures'

export function FinalCTA() {
  const [copied, setCopied] = useState(false)
  const cmd = 'npm i -g pushci && pushci init'

  const handleCopy = () => {
    navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="py-20 sm:py-32 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <div className="rounded-xl border border-border-base bg-surface p-10 sm:p-16 flex flex-col items-center text-center">
          <p className="text-t3 italic text-body mb-6">Look...</p>

          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-t1 max-w-lg">
            You can keep paying for CI.
          </h2>

          <p className="mt-4 text-t2 max-w-md leading-relaxed">
            That's your choice. I'm not judging.
          </p>
          <p className="mt-2 text-t3 text-body italic">
            I am judging a little.
          </p>
          <p className="mt-4 text-t2 max-w-md">
            But you have options now.
          </p>

          <button
            onClick={handleCopy}
            aria-label={copied ? 'Copied' : 'Copy install command'}
            className={`mt-10 rounded-lg bg-raised border border-border-base px-6 py-3 font-mono text-sm text-t2 flex items-center gap-3 hover:border-border-em ease-spring group focus-glow ${btnGesture}`}
          >
            <span className="text-t3">$</span>
            <span>{cmd}</span>
            <span className="text-t3 group-hover:text-t2 transition-colors duration-200">
              {copied ? (
                <svg className="w-4 h-4 text-accent" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              )}
            </span>
          </button>

          <p className="mt-6 text-caption text-t3">
            Or keep paying. That's fine. Totally fine.
          </p>
        </div>
      </div>
    </section>
  )
}
