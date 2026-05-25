import { Link, useLocation } from 'react-router-dom'
import { ViralShare } from './ViralShare'

interface MigrationBlockProps {
  beforeCode: string
  beforeLabel: string
}

const comparisons = [
  { label: 'GitHub Actions', href: '/vs/github-actions' },
  { label: 'GitLab CI', href: '/vs/gitlab-ci' },
  { label: 'CircleCI', href: '/vs/circleci' },
  { label: 'Jenkins', href: '/vs/jenkins' },
  { label: 'Travis CI', href: '/vs/travis-ci' },
  { label: 'Buildkite', href: '/vs/buildkite' },
  { label: 'Drone CI', href: '/vs/drone-ci' },
]

export function MigrationBlock({ beforeCode, beforeLabel }: MigrationBlockProps) {
  const { pathname } = useLocation()

  const afterCode = `# Install PushCI
npx pushci init

# That's it. AI detects your stack
# and runs CI locally.`

  const otherComparisons = comparisons.filter((c) => c.href !== pathname)

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-2xl sm:text-3xl font-bold text-t1">
          Switch in 60 seconds
        </h2>
        <p className="mt-2 text-t2 mb-10">No migration guide needed.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border-base bg-surface overflow-hidden">
            <div className="border-b border-border-base/60 px-4 py-2.5 flex items-center gap-2">
              <span className="text-[11px] font-mono text-t3">{beforeLabel}</span>
            </div>
            <pre className="p-4 overflow-x-auto text-[12px] leading-5 text-t3 font-mono">
              <code>{beforeCode}</code>
            </pre>
          </div>
          <div className="rounded-lg border border-border-base bg-surface overflow-hidden">
            <div className="border-b border-border-base/60 px-4 py-2.5 flex items-center gap-2">
              <span className="text-[11px] font-mono text-accent/80">PushCI</span>
            </div>
            <pre className="p-4 overflow-x-auto text-[12px] leading-5 text-accent/80 font-mono">
              <code>{afterCode}</code>
            </pre>
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="/#pricing"
            className="inline-block rounded-lg bg-t1 px-6 py-3 text-sm font-semibold text-root hover:bg-white transition"
          >
            Get Started Free
          </a>
          <Link
            to="/tools/cost-calculator"
            className="text-sm text-t2 hover:text-t1 transition underline underline-offset-4 decoration-border-base"
          >
            Calculate your savings
          </Link>
        </div>

        {/* Viral share */}
        <div className="mt-12 max-w-xl">
          <ViralShare context="Tell your dev friends" />
        </div>

        {/* Cross-navigation to other comparisons */}
        <div className="mt-10 border-t border-border-base/40 pt-8">
          <p className="text-sm text-t3 mb-3">Also compare with</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {otherComparisons.map((c) => (
              <Link key={c.href} to={c.href} className="text-sm text-t2 hover:text-t1 transition">
                {c.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
