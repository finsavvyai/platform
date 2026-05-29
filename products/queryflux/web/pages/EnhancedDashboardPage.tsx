import { useQuery } from '@tanstack/react-query';
import { MetricsGrid } from '../components/queryflux/MetricsCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Activity, ArrowUpRight, Clock, Database, Server, ShieldCheck, Users, Zap } from 'lucide-react';
import { useConnections } from '../hooks/useConnections';
import { serverMetricsAPI } from '../services/api';

function formatMs(ms: number): string {
  if (ms <= 0) return '—';
  return ms < 1 ? '<1ms' : `${Math.round(ms)}ms`;
}


export function EnhancedDashboardPage() {
  const { data: connections = [], isLoading: connLoading } = useConnections();
  const { data: metrics } = useQuery({
    queryKey: ['server-metrics'],
    queryFn: () => serverMetricsAPI.getGlobal(),
    refetchInterval: 30_000,
  });

  const successRate = metrics && metrics.totalQueries > 0
    ? `${((1 - metrics.totalErrors / metrics.totalQueries) * 100).toFixed(1)}%`
    : '—';

  const dashboardMetrics = [
    {
      label: 'Active Connections',
      value: connLoading ? '…' : connections.length,
      icon: Database,
      iconColor: 'bg-primary/15 text-primary',
    },
    {
      label: 'Queries Run',
      value: metrics ? metrics.totalQueries : '…',
      icon: Activity,
      iconColor: 'bg-success/15 text-success',
    },
    {
      label: 'Avg Query Time',
      value: metrics ? formatMs(metrics.avgMs) : '…',
      icon: Clock,
      iconColor: 'bg-warning/15 text-warning',
    },
    {
      label: 'Success Rate',
      value: metrics ? successRate : '…',
      icon: Server,
      iconColor: 'bg-cyan-500/15 text-cyan-300',
    },
  ];

  return (
    <div className="h-full overflow-auto p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="premium-card animate-rise rounded-[2rem] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-warning">
                <ShieldCheck className="h-3.5 w-3.5" />
                SQL operations cockpit
              </div>
              <h1 className="text-4xl font-black tracking-tight text-gradient-data md:text-6xl">
                Dashboard
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                Overview of your database connections and query activity, tuned for fast diagnosis,
                safe execution, and production-grade visibility.
              </p>
            </div>

            <div className="grid min-w-[18rem] grid-cols-2 gap-3">
              <div className="premium-pill rounded-2xl p-4">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reliability</span>
                <div className="mt-2 flex items-end gap-2">
                  <span className="text-2xl font-black tabular-nums">{successRate}</span>
                  <ArrowUpRight className="mb-1 h-4 w-4 text-success" />
                </div>
              </div>
              <div className="premium-pill rounded-2xl p-4">
                <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Refresh</span>
                <div className="mt-2 text-2xl font-black tabular-nums">30s</div>
              </div>
            </div>
          </div>
        </section>

        <MetricsGrid metrics={dashboardMetrics} columns={4} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Query Activity
                  </CardTitle>
                  <CardDescription>Backend query statistics</CardDescription>
                </div>
                <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  Live
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {metrics ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Total queries', value: metrics.totalQueries },
                    { label: 'Total errors', value: metrics.totalErrors },
                    { label: 'P50 latency', value: formatMs(metrics.p50Ms) },
                    { label: 'P95 latency', value: formatMs(metrics.p95Ms) },
                    { label: 'P99 latency', value: formatMs(metrics.p99Ms) },
                    { label: 'Max latency', value: formatMs(metrics.maxMs) },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-2xl border border-border/70 bg-background/35 p-4">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
                      <div className="mt-2 text-xl font-black tabular-nums">{value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading metrics…</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-primary" />
                    Active Connections
                  </CardTitle>
                  <CardDescription>Your connected databases</CardDescription>
                </div>
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {connLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : connections.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 bg-background/25 p-6 text-sm text-muted-foreground">
                  No connections yet. Add one on the Connections page.
                </div>
              ) : (
                <div className="space-y-3">
                  {connections.map((conn) => (
                    <div
                      key={conn.id}
                      className="group rounded-2xl border border-border/70 bg-background/35 p-4 transition-all hover:border-primary/45 hover:bg-primary/10"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15">
                            <Database className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{conn.name}</p>
                            <p className="text-sm text-muted-foreground">{conn.type}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                          <span className="text-xs font-semibold text-success">connected</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-warning" />
              Query Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics ? (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {[
                  { label: 'P50 Latency', value: metrics.p50Ms, color: 'bg-primary' },
                  { label: 'P95 Latency', value: metrics.p95Ms, color: 'bg-warning' },
                  { label: 'P99 Latency', value: metrics.p99Ms, color: 'bg-red-500' },
                ].map(({ label, value, color }) => {
                  const pct = metrics.maxMs > 0 ? Math.min((value / metrics.maxMs) * 100, 100) : 0;
                  return (
                    <div key={label} className="rounded-2xl border border-border/70 bg-background/35 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-muted-foreground">{label}</span>
                        <span className="text-sm font-black tabular-nums">{formatMs(value)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                        <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading latency data…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
