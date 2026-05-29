'use client'

import { useEffect } from 'react'
import { AppLayout } from '@/components/layout/app-layout'
import { Breadcrumb } from '@/components/navigation/breadcrumb'
import { useUIStore } from '@/store/ui'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GitBranch,
  Play,
  Pause,
  CheckCircle,
  AlertCircle,
  FileText,
  Zap,
} from 'lucide-react'

const stats = {
  activePipelines: 2,
  docsProcessed: 14_832,
  avgRetrievalTime: '45ms',
  successRate: '99.2%',
}

const pipelines = [
  {
    id: '1',
    name: 'Customer Support RAG',
    status: 'Running',
    documentCount: 6_420,
    model: 'GPT-4 Turbo',
    lastRun: '2026-03-07 14:30',
    chunksGenerated: 48_150,
  },
  {
    id: '2',
    name: 'Internal Knowledge Base',
    status: 'Running',
    documentCount: 4_218,
    model: 'Claude 3.5 Sonnet',
    lastRun: '2026-03-07 12:15',
    chunksGenerated: 31_635,
  },
  {
    id: '3',
    name: 'Code Documentation',
    status: 'Stopped',
    documentCount: 4_194,
    model: 'GPT-4 Turbo',
    lastRun: '2026-03-06 09:00',
    chunksGenerated: 29_358,
  },
]

const pipelineStages = ['Ingest', 'Chunk', 'Embed', 'Index']

function getStatusBadge(status: string) {
  if (status === 'Running') return <Badge variant="default">{status}</Badge>
  if (status === 'Stopped') return <Badge variant="secondary">{status}</Badge>
  return <Badge variant="destructive">{status}</Badge>
}

function getStatusIcon(status: string) {
  if (status === 'Running') return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
  if (status === 'Stopped') return <Pause className="h-4 w-4 text-muted-foreground" />
  return <AlertCircle className="h-4 w-4 text-destructive" />
}

export default function RAGPage() {
  const { setBreadcrumbs } = useUIStore()

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'RAG Pipelines', active: true },
    ])
  }, [setBreadcrumbs])

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <Breadcrumb />
          <div className="mt-4">
            <h1 className="text-2xl font-bold tracking-tight">RAG Pipelines</h1>
            <p className="text-muted-foreground">
              Monitor and manage Retrieval-Augmented Generation pipelines.
            </p>
          </div>
        </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pipelines</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activePipelines}</div>
            <p className="text-xs text-muted-foreground">Of 3 total pipelines</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Processed</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.docsProcessed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total across all pipelines</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Retrieval Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgRetrievalTime}</div>
            <p className="text-xs text-muted-foreground">P50 latency</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Stages</CardTitle>
          <CardDescription>Standard RAG pipeline processing flow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2">
            {pipelineStages.map((stage, idx) => (
              <div key={stage} className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
                  <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />
                  <span className="text-sm font-medium">{stage}</span>
                </div>
                {idx < pipelineStages.length - 1 && (
                  <Zap className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipelines</CardTitle>
          <CardDescription>Manage your RAG pipeline configurations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pipelines.map((pipeline) => (
              <div key={pipeline.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(pipeline.status)}
                    <h3 className="font-semibold">{pipeline.name}</h3>
                    {getStatusBadge(pipeline.status)}
                  </div>
                  <Button variant="outline" size="sm">
                    {pipeline.status === 'Running' ? (
                      <><Pause className="h-3 w-3 mr-1" /> Pause</>
                    ) : (
                      <><Play className="h-3 w-3 mr-1" /> Start</>
                    )}
                  </Button>
                </div>
                <div className="grid grid-cols-4 gap-4 text-sm text-muted-foreground">
                  <div>Documents: <span className="font-medium text-foreground">{pipeline.documentCount.toLocaleString()}</span></div>
                  <div>Chunks: <span className="font-medium text-foreground">{pipeline.chunksGenerated.toLocaleString()}</span></div>
                  <div>Model: <span className="font-medium text-foreground">{pipeline.model}</span></div>
                  <div>Last run: <span className="font-medium text-foreground">{pipeline.lastRun}</span></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </AppLayout>
  )
}
