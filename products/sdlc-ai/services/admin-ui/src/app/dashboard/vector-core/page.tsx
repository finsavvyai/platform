'use client'

import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TreePine, Database, Zap, Activity, Settings, Plus } from 'lucide-react'

const indexes = [
  { name: 'documents-embeddings', vectorCount: 1_284_320, dimensions: 1536, metric: 'cosine', status: 'active', sizeGb: 4.2 },
  { name: 'code-snippets', vectorCount: 892_150, dimensions: 768, metric: 'euclidean', status: 'active', sizeGb: 2.1 },
  { name: 'knowledge-base', vectorCount: 456_780, dimensions: 1536, metric: 'cosine', status: 'rebuilding', sizeGb: 1.5 },
]

const totalVectors = indexes.reduce((sum, idx) => sum + idx.vectorCount, 0)
const totalSize = indexes.reduce((sum, idx) => sum + idx.sizeGb, 0)

const perfMetrics = [
  { label: 'P50', value: '3.2 ms' },
  { label: 'P90', value: '9.8 ms' },
  { label: 'P99', value: '18.7 ms' },
  { label: 'Throughput', value: '12,400 qps' },
]

const resourceMetrics = [
  { label: 'CPU', value: '34%' },
  { label: 'Memory', value: '6.8 / 16 GB' },
  { label: 'Disk I/O', value: '120 MB/s' },
  { label: 'Network', value: '45 MB/s' },
]

function statusBadge(status: string) {
  if (status === 'active') return <Badge variant="default">Active</Badge>
  if (status === 'rebuilding') return <Badge variant="secondary">Rebuilding</Badge>
  return <Badge variant="outline">{status}</Badge>
}

function MetricsList({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="space-y-3 text-sm">
      {items.map((m) => (
        <div key={m.label} className="flex justify-between">
          <span className="text-muted-foreground">{m.label}</span>
          <span className="font-medium">{m.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function VectorCorePage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vector Core</h1>
            <p className="text-muted-foreground">
              High-performance Rust vector search and embeddings management.
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" /> New Index
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Vectors</CardTitle>
              <TreePine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(totalVectors / 1_000_000).toFixed(2)}M</div>
              <p className="text-xs text-muted-foreground">Across all indexes</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Index Size</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSize.toFixed(1)} GB</div>
              <p className="text-xs text-muted-foreground">Total storage used</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Query Latency P50</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">3.2 ms</div>
              <p className="text-xs text-muted-foreground">Median query time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Query Latency P99</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">18.7 ms</div>
              <p className="text-xs text-muted-foreground">99th percentile</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Indexes</CardTitle>
            <CardDescription>Manage vector indexes and their configurations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {indexes.map((idx) => (
                <div key={idx.name} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium font-mono text-sm">{idx.name}</span>
                      {statusBadge(idx.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {idx.vectorCount.toLocaleString()} vectors &middot; {idx.dimensions}d &middot; {idx.metric} &middot; {idx.sizeGb} GB
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" aria-label="Configure index">
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4" /> Query Performance
              </CardTitle>
              <CardDescription>Search latency distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricsList items={perfMetrics} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" /> Resource Usage
              </CardTitle>
              <CardDescription>Current resource consumption</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricsList items={resourceMetrics} />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
