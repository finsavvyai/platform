import { Link } from 'react-router-dom'
import { useReveal } from './useReveal'

const terminalLines = [
  '$ pushci release',
  '  Detected: Go 1.22 + .goreleaser.yml',
  '  Building darwin/amd64, darwin/arm64, linux/amd64...',
  '  Building linux/arm64, windows/amd64, windows/arm64...',
  '  Creating GitHub Release v1.2.0...',
  '  Updating Homebrew tap...',
  '  Publishing to npm...',
  '  Done in 47s. Saved $0.96 vs GitHub Actions.',
]

export function ReleaseFeature() {
  const ref = useReveal()

  return (
    <section ref={ref} className="reveal py-20 sm:py-32 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <p className="text-sm font-medium text-accent tracking-wide">Local Release</p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-t1 max-w-2xl">
          Let me get this straight. We're paying per minute. To zip files. And upload them.
        </h2>
        <p className="mt-4 text-t2 max-w-lg leading-relaxed">
          <code className="font-mono text-accent">pushci release</code> builds binaries for
          6 platforms, creates a GitHub Release, pushes your Homebrew formula, and publishes
          to npm. All from your machine. $0.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-2 items-start">
          {/* Terminal block */}
          <div className="rounded-lg border border-border-base bg-surface overflow-hidden">
            <div className="border-b border-border-base/60 px-4 py-2 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/60" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <span className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-[11px] font-mono text-t3">terminal</span>
            </div>
            <pre className="p-4 text-sm font-mono text-t2 leading-relaxed overflow-x-auto">
              {terminalLines.join('\n')}
            </pre>
          </div>

          {/* Callout + CTA */}
          <div className="space-y-6">
            <div className="rounded-lg border border-border-base bg-surface p-6">
              <p className="text-sm text-t3 font-mono">Cost per release</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-3xl font-bold text-accent font-mono">$0</span>
                <span className="text-t3 line-through font-mono text-sm">$0.96</span>
                <span className="text-xs text-t3">vs GitHub Actions</span>
              </div>
              <p className="mt-3 text-sm text-t3 leading-relaxed">
                6 platforms. GitHub Release. Homebrew tap. npm publish. Done in under a minute.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
              <Link
                to="/release"
                className="rounded-lg bg-t1 px-5 py-2.5 text-sm font-semibold text-root hover:bg-white transition"
              >
                Learn more
              </Link>
              <a href="/#pricing" className="text-sm text-t2 hover:text-t1 transition">
                Install PushCI
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
