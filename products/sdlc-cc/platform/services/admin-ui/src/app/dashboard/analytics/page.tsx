'use client'

import { useEffect, useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui'
import { apiClient } from '@/lib/api-client'
import { Activity, DollarSign, Hash, Clock } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface Overview {
  total_queries: number
  total_tokens: number
  total_usd_cents: number
  avg_latency_ms: number
  top_models: Array<{ provider: string; model: string; queries: number; usd_cents: number }>
  top_users: Array<{ user_id: string; queries: number; usd_cents: number }>
}

interface TimeseriesPoint { bucket_start: string; value: number }

interface TimeseriesResult {
  metric: string
  granularity: string
  buckets: TimeseriesPoint[]
}

const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`

// Default window: last 30 days.
const defaultRange = () => {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

export default function AnalyticsPage() {
  const { setBreadcrumbs } = useUIStore()
  const [range, setRange] = useState(defaultRange())
  const [overview, setOverview] = useState<Overview | null>(null)
  const [series, setSeries] = useState<TimeseriesResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Analytics', active: true },
    ])
  }, [setBreadcrumbs])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const from = `${range.from}T00:00:00Z`
    const to = `${range.to}T23:59:59Z`
    Promise.all([
      apiClient.get<Overview>(`/admin/analytics/overview?from=${from}&to=${to}`),
      apiClient.get<TimeseriesResult>(
        `/admin/analytics/timeseries?metric=usd_cents&granularity=day&from=${from}&to=${to}`,
      ),
    ])
      .then(([o, s]) => {
        if (cancelled) return
        setOverview(o)
        setSeries(s)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError((e as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range])

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Breadcrumb />
          <div className="mt-4">
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">
              Usage, spend, and performance across your tenant.
            </p>
          </div>
        </div>

        {/* Date range picker */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Date range</CardTitle>
            <CardDescription>UTC. Maximum window: 365 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col text-sm">
                <span className="mb-1 text-muted-foreground">From</span>
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                  className="rounded border bg-background px-3 py-2"
                />
              </label>
              <label className="flex flex-col text-sm">
                <span className="mb-1 text-muted-foreground">To</span>
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                  className="rounded border bg-background px-3 py-2"
                />
              </label>
              <Button variant="outline" onClick={() => setRange(defaultRange())}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '—' : (overview?.total_queries ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
              <Hash className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '—' : (overview?.total_tokens ?? 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '—' : dollars(overview?.total_usd_cents ?? 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? '—' : `${(overview?.avg_latency_ms ?? 0).toFixed(0)}ms`}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily spend timeseries (placeholder; chart wiring deferred) */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Spend</CardTitle>
            <CardDescription>USD per day across all models</CardDescription>
          </CardHeader>
          <CardContent>
            {series && series.buckets.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={series.buckets.map((b) => ({
                      day: b.bucket_start.slice(0, 10),
                      usd: Number(b.value) / 100,
                    }))}
                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) => `$${v.toFixed(2)}`}
                      labelFormatter={(l) => `Day ${l}`}
                    />
                    <Area
                      type="monotone"
                      dataKey="usd"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary) / 0.2)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
                No spend events yet for this window.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leaderboards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Models by Spend</CardTitle>
              <CardDescription>Highest cost contributors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(overview?.top_models ?? []).map((m) => (
                  <div
                    key={`${m.provider}/${m.model}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="font-medium">{m.provider}/{m.model}</span>
                    <span className="text-muted-foreground">
                      {m.queries.toLocaleString()} queries · {dollars(m.usd_cents)}
                    </span>
                  </div>
                ))}
                {!loading && (overview?.top_models?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">No data in range.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Users by Spend</CardTitle>
              <CardDescription>Heaviest consumers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(overview?.top_users ?? []).map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs">{u.user_id}</span>
                    <span className="text-muted-foreground">
                      {u.queries.toLocaleString()} queries · {dollars(u.usd_cents)}
                    </span>
                  </div>
                ))}
                {!loading && (overview?.top_users?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground">No data in range.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
