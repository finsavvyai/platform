import { useState } from 'react'
import { TerminalDemo } from './TerminalDemo'
import DiamondHero from './DiamondHero'
import { BillSavingsCalc } from './BillSavingsCalc'
import { btnGesture, btnGesturePrimary } from '../styles/gestures'

function CopyCommand() {
  const [copied, setCopied] = useState(false)
  const cmd = 'npm i -g pushci && pushci init'

  const handleCopy = () => {
    navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy install command'}
      className={`rounded-lg bg-surface border border-border-base px-5 py-3 font-mono text-sm text-t2 flex items-center gap-3 hover:border-border-em ease-spring group focus-glow ${btnGesture}`}
    >
      <span className="text-t3">$</span>
      <span>{cmd}</span>
      <span className="text-t3 group-hover:text-t2 transition-colors duration-200 ml-1">
        {copied ? (
          <svg className="w-4 h-4 text-accent" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        ) : (
          <svg className="w-4 h-4" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        )}
      </span>
    </button>
  )
}

export function Hero() {
  return (
    <section className="relative pt-28 sm:pt-36 lg:pt-44 pb-20 sm:pb-28 px-4 sm:px-6">
      <div className="mx-auto max-w-[1080px]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12">
          {/* Text */}
          <div className="flex-1">
            <p className="text-body font-medium text-accent tracking-wide">
              So you're paying GitHub by the minute. To run npm test.
              <a href="#bill-calc" className="ml-2 text-t2 hover:text-t1 underline underline-offset-4">
                see the damage →
              </a>
            </p>

            <h1 className="mt-4 text-[2.5rem] sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] text-t1 max-w-4xl">
              Deploy faster.{' '}
              <span className="gradient-text">Break less. Fix instantly.</span>
            </h1>

            <p className="mt-6 text-lg sm:text-xl text-t2 leading-relaxed max-w-xl">
              AI-powered pipelines that predict failures, accelerate builds, and roll
              back broken deploys before users notice. Self-hosted runners, zero cloud
              minutes, $0 forever.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-start gap-4">
              <a
                href="https://app.pushci.dev"
                className={`rounded-lg bg-t1 px-6 py-3 text-sm font-semibold text-root hover:bg-white focus-glow ${btnGesturePrimary}`}
              >
                Start building
              </a>
              <a
                href="/docs"
                className={`rounded-lg bg-surface border border-border-base px-6 py-3 text-sm font-semibold text-t1 hover:border-border-em focus-glow ${btnGesture}`}
              >
                View docs
              </a>
              <CopyCommand />
            </div>

            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-2 text-body text-t3">
              <span>Predict failures</span>
              <span className="text-border-base">·</span>
              <span>Auto-rollback</span>
              <span className="text-border-base">·</span>
              <span>Multi-env</span>
              <span className="text-border-base">·</span>
              <span className="text-accent">$0 forever</span>
              <span className="text-border-base">·</span>
              <span>Works everywhere</span>
            </div>
          </div>

          {/* 3D Diamond */}
          <div className="hidden lg:flex items-center justify-center flex-shrink-0">
            <DiamondHero />
          </div>
        </div>

        <div className="mt-16">
          <TerminalDemo />
        </div>

        <BillSavingsCalc />
      </div>
    </section>
  )
}
