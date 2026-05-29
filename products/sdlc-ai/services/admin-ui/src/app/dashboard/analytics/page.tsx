'use client'

import { useState } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BarChart3, Clock, AlertTriangle, Users, TrendingUp, Activity } from 'lucide-react'
import { topEndpoints, errorBreakdown, requestVolumeData, responseTimeData } from './data'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

const timeRanges = ['24h', '7d', '30d', '90d'] as const
const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
}

export default function AnalyticsPage() {
  const [selectedRange, setSelectedRange] = useState<(typeof timeRanges)[number]>('7d')

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Request volume, response times, and error tracking across all services.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            {timeRanges.map((range) => (
              <Button
                key={range}
                size="sm"
                variant={selectedRange === range ? 'default' : 'ghost'}
                onClick={() => setSelectedRange(range)}
              >
                {range}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,284,032</div>
              <p className="text-xs text-muted-foreground">+14.2% from previous period</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">47 ms</div>
              <p className="text-xs text-muted-foreground">P99: 189 ms</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0.07%</div>
              <p className="text-xs text-muted-foreground">903 total errors</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">892</div>
              <p className="text-xs text-muted-foreground">+23 new this period</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Request Volume
              </CardTitle>
              <CardDescription>Requests per hour over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={requestVolumeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="hour" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} interval={3} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <defs>
                    <linearGradient id="requestGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="requests" stroke="hsl(var(--primary))" fill="url(#requestGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" /> Response Time Distribution
              </CardTitle>
              <CardDescription>Histogram of response latencies</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={responseTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} label={{ value: 'ms', position: 'insideBottomRight', offset: -5, fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Endpoints</CardTitle>
              <CardDescription>Highest traffic API endpoints</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topEndpoints.map((ep) => (
                  <div key={ep.path} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="shrink-0">{ep.method}</Badge>
                      <span className="truncate font-mono text-xs">{ep.path}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-muted-foreground">
                      <span>{ep.calls.toLocaleString()} calls</span>
                      <span>{ep.avgMs} ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Error Breakdown</CardTitle>
              <CardDescription>Errors grouped by HTTP status code</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {errorBreakdown.map((err) => (
                  <div key={err.type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{err.type}</span>
                      <span className="text-muted-foreground">{err.count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-destructive/70"
                        style={{ width: `${err.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
