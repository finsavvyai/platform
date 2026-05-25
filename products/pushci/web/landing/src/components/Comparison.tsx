import { Link } from 'react-router-dom'
import { rows } from './comparisonData'
import { useReveal } from './useReveal'
import { ViralShare } from './ViralShare'

const headers = [
  { label: '', href: '' },
  { label: 'PushCI', href: '' },
  { label: 'GitHub Actions', href: '/vs/github-actions' },
  { label: 'GitLab CI', href: '/vs/gitlab-ci' },
  { label: 'CircleCI', href: '/vs/circleci' },
]

export function Comparison() {
  const ref = useReveal()

  return (
    <section ref={ref} className="reveal py-20 sm:py-32 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-t1">
          How PushCI compares
        </h2>
        <p className="mt-3 text-t2 max-w-lg">
          Side-by-side with the tools you're probably using today.
        </p>

        {/* Mobile card view */}
        <div className="mt-10 space-y-3 sm:hidden">
          {rows.map((r) => (
            <div key={r.label} className="rounded-lg border border-border-base bg-surface p-4">
              <div className="text-body font-medium text-t2 mb-3">{r.label}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-accent/5 border border-accent/10 px-3 py-2">
                  <div className="text-t3 mb-0.5">PushCI</div>
                  <div className="text-accent font-medium">{r.pushci}</div>
                </div>
                <div className="rounded-lg bg-raised/30 px-3 py-2">
                  <div className="text-t3 mb-0.5">GitHub</div>
                  <div className="text-t2">{r.github}</div>
                </div>
                <div className="rounded-lg bg-raised/30 px-3 py-2">
                  <div className="text-t3 mb-0.5">GitLab</div>
                  <div className="text-t2">{r.gitlab}</div>
                </div>
                <div className="rounded-lg bg-raised/30 px-3 py-2">
                  <div className="text-t3 mb-0.5">CircleCI</div>
                  <div className="text-t2">{r.circle}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="mt-10 overflow-x-auto hidden sm:block rounded-lg border border-border-base">
          <table className="w-full min-w-[640px] text-body">
            <thead>
              <tr className="border-b border-border-base bg-surface/40">
                {headers.map((h, i) => (
                  <th
                    key={h.label || 'label'}
                    className={`py-3 px-4 text-left text-body font-medium ${
                      i === 1 ? 'text-accent' : 'text-t3'
                    }`}
                  >
                    {h.href ? (
                      <Link to={h.href} className="hover:text-t2 transition-colors duration-200 underline underline-offset-4 decoration-border-base">{h.label}</Link>
                    ) : h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border-base/40 last:border-0">
                  <td className="py-3 px-4 text-t2 font-medium">{r.label}</td>
                  <td className="py-3 px-4 text-accent">{r.pushci}</td>
                  <td className="py-3 px-4 text-t3">{r.github}</td>
                  <td className="py-3 px-4 text-t3">{r.gitlab}</td>
                  <td className="py-3 px-4 text-t3">{r.circle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-body">
          <Link to="/vs/github-actions" className="text-t2 hover:text-t1 transition-colors duration-200">vs GitHub Actions</Link>
          <Link to="/vs/gitlab-ci" className="text-t2 hover:text-t1 transition-colors duration-200">vs GitLab CI</Link>
          <Link to="/vs/circleci" className="text-t2 hover:text-t1 transition-colors duration-200">vs CircleCI</Link>
          <Link to="/vs/jenkins" className="text-t2 hover:text-t1 transition-colors duration-200">vs Jenkins</Link>
          <Link to="/vs/travis-ci" className="text-t2 hover:text-t1 transition-colors duration-200">vs Travis CI</Link>
          <Link to="/vs/buildkite" className="text-t2 hover:text-t1 transition-colors duration-200">vs Buildkite</Link>
          <Link to="/vs/drone-ci" className="text-t2 hover:text-t1 transition-colors duration-200">vs Drone CI</Link>
        </div>
        <div className="mt-10 max-w-xl">
          <ViralShare context="Show this to your DevOps team" />
        </div>
      </div>
    </section>
  )
}
