import { useReveal } from './useReveal'

const pipelineStages = [
  { name: 'install', status: 'success', duration: '12s' },
  { name: 'lint', status: 'success', duration: '4s' },
  { name: 'test', status: 'success', duration: '28s' },
  { name: 'build', status: 'success', duration: '41s' },
  { name: 'deploy', status: 'running', duration: '—' },
]

const logs = [
  { t: '12:04:21', level: 'info', msg: 'pushci: stack detected — Next.js 14, pnpm, Turbo' },
  { t: '12:04:22', level: 'info', msg: 'cache hit: node_modules (5.2GB restored in 1.1s)' },
  { t: '12:04:23', level: 'ai', msg: 'AI: test suite reordered — slowest first, estimated -18s' },
  { t: '12:04:51', level: 'ok', msg: '✓ 342 tests passed' },
  { t: '12:05:32', level: 'ai', msg: 'AI: build artifact unchanged, skipping deploy to prod' },
  { t: '12:05:33', level: 'warn', msg: 'staging diverged from prod — rollback token armed' },
]

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    success: 'bg-accent',
    running: 'bg-blue-400 animate-pulse',
    failed: 'bg-red-500',
    pending: 'bg-border-base',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-border-base'}`} />
}

function levelColor(level: string) {
  if (level === 'ok') return 'text-accent'
  if (level === 'warn') return 'text-amber-400'
  if (level === 'err') return 'text-red-400'
  if (level === 'ai') return 'text-blue-400'
  return 'text-t3'
}

export function ProductUI() {
  const ref = useReveal()

  return (
    <section ref={ref} className="reveal py-20 sm:py-28 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1180px]">
        <div className="text-center mb-14">
          <p className="text-body font-medium text-accent tracking-wide uppercase">
            The product
          </p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight text-t1">
            One pane for every pipeline
          </h2>
          <p className="mt-5 text-lg text-t2 max-w-2xl mx-auto">
            Pipeline graph, live logs, deployment status, and AI-driven insights —
            all in a single view that updates in real time.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Pipeline graph */}
          <div className="lg:col-span-3 rounded-2xl border border-border-base bg-surface/40 p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <StatusDot status="running" />
                <span className="text-sm font-mono text-t1">pushci-api · main</span>
                <span className="text-xs text-t3">#1847</span>
              </div>
              <span className="text-xs text-t3 font-mono">1m 25s elapsed</span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {pipelineStages.map((s, i) => (
                <div key={s.name} className="flex items-center gap-2 flex-shrink-0">
                  <div className={`rounded-lg border px-4 py-3 min-w-[120px] ${
                    s.status === 'running'
                      ? 'border-blue-400/40 bg-blue-400/5'
                      : s.status === 'success'
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-border-base bg-surface/30'
                  }`}>
                    <div className="flex items-center gap-2">
                      <StatusDot status={s.status} />
                      <span className="text-sm font-medium text-t1">{s.name}</span>
                    </div>
                    <div className="text-xs text-t3 mt-1 font-mono">{s.duration}</div>
                  </div>
                  {i < pipelineStages.length - 1 && (
                    <div className="h-px w-4 bg-border-base flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4 pt-5 border-t border-border-base">
              <div>
                <div className="text-xs text-t3 uppercase tracking-wider">Success rate</div>
                <div className="text-xl font-bold text-accent mt-1">98.4%</div>
              </div>
              <div>
                <div className="text-xs text-t3 uppercase tracking-wider">Avg duration</div>
                <div className="text-xl font-bold text-t1 mt-1">1m 42s</div>
              </div>
              <div>
                <div className="text-xs text-t3 uppercase tracking-wider">Cache hit</div>
                <div className="text-xl font-bold text-blue-400 mt-1">87%</div>
              </div>
            </div>
          </div>

          {/* Logs */}
          <div className="lg:col-span-2 rounded-2xl border border-border-base bg-root/60 p-6 font-mono text-xs">
            <div className="flex items-center justify-between mb-4">
              <span className="text-t2 text-sm font-semibold">Live logs</span>
              <span className="flex items-center gap-1.5 text-t3">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                streaming
              </span>
            </div>
            <div className="space-y-1.5">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-t3 flex-shrink-0">{l.t}</span>
                  <span className={`${levelColor(l.level)} leading-relaxed`}>{l.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Insight row */}
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-border-base bg-surface/30 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-400 text-sm font-semibold">AI insight</span>
            </div>
            <p className="text-sm text-t2 leading-relaxed">
              Similar failure on commit a3f1c2 took 14m to roll back. Armed the
              rollback token automatically.
            </p>
          </div>
          <div className="rounded-xl border border-border-base bg-surface/30 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-accent text-sm font-semibold">Deploy status</span>
            </div>
            <p className="text-sm text-t2 leading-relaxed">
              Canary rolled to 10% at 12:05. Error rate stable. Promoting to 100%
              in 4 min if metrics hold.
            </p>
          </div>
          <div className="rounded-xl border border-border-base bg-surface/30 p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400 text-sm font-semibold">Risk score</span>
            </div>
            <p className="text-sm text-t2 leading-relaxed">
              Low (12/100). No schema changes. No new deps. Bundle size -2.1kb.
              Safe to auto-deploy.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
