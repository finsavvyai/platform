import { useReveal } from './useReveal'

const benchmarks = [
  {
    label: 'Setup time',
    pushci: { value: 12, display: '12s', note: 'pushci init' },
    github: { value: 180, display: '3min', note: '.github/workflows/' },
    circle: { value: 240, display: '4min', note: '.circleci/config.yml' },
  },
  {
    label: 'Cold start',
    pushci: { value: 0.5, display: '0.5s', note: 'Local binary' },
    github: { value: 45, display: '45s', note: 'VM spin-up' },
    circle: { value: 30, display: '30s', note: 'Container pull' },
  },
  {
    label: 'npm test (avg)',
    pushci: { value: 8, display: '8s', note: 'Local machine' },
    github: { value: 42, display: '42s', note: 'Shared runner' },
    circle: { value: 35, display: '35s', note: 'Medium container' },
  },
  {
    label: 'Config lines',
    pushci: { value: 0, display: '0', note: 'Auto-detected' },
    github: { value: 45, display: '45', note: 'YAML required' },
    circle: { value: 38, display: '38', note: 'YAML required' },
  },
  {
    label: 'Monthly cost (100 runs)',
    pushci: { value: 0, display: '$0', note: 'Self-hosted' },
    github: { value: 14, display: '$14', note: '@$0.008/min' },
    circle: { value: 11, display: '$11', note: '@$0.006/min' },
  },
]

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="h-2 rounded-full bg-raised overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all duration-700`}
        style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  )
}

export function Benchmarks() {
  const ref = useReveal()

  return (
    <section ref={ref} className="reveal py-20 sm:py-28 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-t1">
          Speed comparison
        </h2>
        <p className="mt-3 text-sm text-t3 max-w-lg">
          Real benchmarks on a standard Node.js project. PushCI runs on your machine — no VM spin-up, no container pulls, no waiting.
        </p>

        {/* Legend */}
        <div className="flex gap-6 mt-8 mb-6 text-xs">
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-accent" /> PushCI</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-t3" /> GitHub Actions</span>
          <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500" /> CircleCI</span>
        </div>

        <div className="space-y-6">
          {benchmarks.map(b => {
            const max = Math.max(b.pushci.value, b.github.value, b.circle.value, 1)
            return (
              <div key={b.label} className="rounded-xl border border-border-base/50 bg-surface/30 p-5">
                <div className="text-sm font-medium text-t1 mb-4">{b.label}</div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-t2 w-24 text-right font-mono">{b.pushci.display}</span>
                    <div className="flex-1"><Bar value={b.pushci.value} max={max} color="bg-accent" /></div>
                    <span className="text-[11px] text-t3 w-28">{b.pushci.note}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-t2 w-24 text-right font-mono">{b.github.display}</span>
                    <div className="flex-1"><Bar value={b.github.value} max={max} color="bg-t3" /></div>
                    <span className="text-[11px] text-t3 w-28">{b.github.note}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-t2 w-24 text-right font-mono">{b.circle.display}</span>
                    <div className="flex-1"><Bar value={b.circle.value} max={max} color="bg-blue-500" /></div>
                    <span className="text-[11px] text-t3 w-28">{b.circle.note}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
