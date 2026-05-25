'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Coins,
  DollarSign,
  Zap,
  Brain,
  TrendingUp,
} from 'lucide-react'
import { modelUsage, tenantCosts, barColors, dailyUsageData } from './data'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export default function TokenUsagePage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Token Usage</h1>
          <p className="text-muted-foreground">
            AI model token consumption, cost tracking, and allocation by tenant.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tokens Used</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">11.53M</div>
              <p className="text-xs text-muted-foreground">+18% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$869.20</div>
              <p className="text-xs text-muted-foreground">Budget: $1,200</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Tokens / Request</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1,842</div>
              <p className="text-xs text-muted-foreground">-5% optimization gain</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Models Active</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">5</div>
              <p className="text-xs text-muted-foreground">Across 2 providers</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-4 w-4" /> Usage by Model
              </CardTitle>
              <CardDescription>Token consumption breakdown per AI model</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {modelUsage.map((m, i) => (
                  <div key={m.model} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{m.model}</span>
                      <span className="text-muted-foreground">
                        {(m.tokens / 1_000_000).toFixed(1)}M tokens &middot; ${m.cost.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full ${barColors[i]}`}
                        style={{ width: `${m.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Daily Usage Trend
              </CardTitle>
              <CardDescription>Token consumption over the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={dailyUsageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`${(value / 1000).toFixed(0)}K tokens`, 'Usage']}
                  />
                  <defs>
                    <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="tokens" stroke="hsl(var(--primary))" fill="url(#tokenGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Cost Allocation by Tenant
              </CardTitle>
              <CardDescription>Token usage and cost distribution across tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Tenant</th>
                      <th className="pb-2 font-medium">Plan</th>
                      <th className="pb-2 font-medium text-right">Tokens</th>
                      <th className="pb-2 font-medium text-right">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantCosts.map((t) => (
                      <tr key={t.tenant} className="border-b last:border-0">
                        <td className="py-2 font-medium">{t.tenant}</td>
                        <td className="py-2">
                          <Badge variant="outline">{t.plan}</Badge>
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {(t.tokens / 1_000_000).toFixed(1)}M
                        </td>
                        <td className="py-2 text-right font-medium">${t.cost.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
