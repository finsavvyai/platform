import { useEffect, useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { RefreshCw } from 'lucide-react'
import { api } from '../api/client'

interface SourceHealthData {
  source_id: string
  name: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  last_success?: string
  entity_count: number
  avg_latency_ms: number
  consecutive_failures: number
}

interface SourceHealthResponse {
  sources: SourceHealthData[]
  all_healthy: boolean
  degraded: string[]
}

function getStatusColor(status: string): 'green' | 'orange' | 'red' | 'gray' {
  switch (status) {
    case 'healthy': return 'green'
    case 'degraded': return 'orange'
    case 'down': return 'red'
    default: return 'gray'
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'Never'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Invalid date'
  }
}

function SourceCard({ source }: { source: SourceHealthData }) {
  const statusColor = getStatusColor(source.status)

  return (
    <Card className="p-lg">
      <div className="flex items-start justify-between mb-md">
        <div className="flex-1">
          <h3 className="sf-headline mb-xs">{source.name}</h3>
          <p className="sf-caption text-gray-600">{source.source_id}</p>
        </div>
        <Badge color={statusColor} size="sm">
          {source.status.charAt(0).toUpperCase() + source.status.slice(1)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-md">
        <div>
          <p className="sf-caption font-medium mb-xs">Records</p>
          <p className="sf-body">{source.entity_count.toLocaleString()}</p>
        </div>
        <div>
          <p className="sf-caption font-medium mb-xs">Avg Latency</p>
          <p className="sf-body">{source.avg_latency_ms}ms</p>
        </div>
        <div>
          <p className="sf-caption font-medium mb-xs">Last Success</p>
          <p className="sf-caption">{formatDate(source.last_success)}</p>
        </div>
        <div>
          <p className="sf-caption font-medium mb-xs">Failures</p>
          <p className={`sf-body ${source.consecutive_failures > 0 ? 'text-apple-red' : 'text-apple-green'}`}>
            {source.consecutive_failures}
          </p>
        </div>
      </div>
    </Card>
  )
}

export function SourceHealth() {
  const [data, setData] = useState<SourceHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)

  const fetchHealth = async () => {
    try {
      setError('')
      const result = await api.get<SourceHealthResponse>('/admin/sources/health')
      setData(result ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load source health')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = async () => {
    setSyncing(true)
    try {
      await api.post('/admin/lists/refresh', {})
      await new Promise(r => setTimeout(r, 1000))
      fetchHealth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Source Health"
        description="Monitor the health and status of all data sources"
      />

      {data && !data.all_healthy && (
        <Card className="mb-lg p-lg">
          <p className="sf-body text-red-600 font-medium">
            {data.degraded.length} source{data.degraded.length !== 1 ? 's' : ''}
            {' '}experiencing issues. Manual resync recommended.
          </p>
        </Card>
      )}

      <Card className="mb-lg p-lg">
        <div className="flex items-center justify-between mb-md">
          <div>
            <h3 className="sf-headline mb-xs">
              {data?.sources.length ?? 0} Data Sources
            </h3>
            <p className="sf-caption text-gray-600">
              {data?.all_healthy ? 'All systems operational' : 'Some sources need attention'}
            </p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={syncing || loading}
            className="flex items-center gap-sm"
          >
            <RefreshCw className="w-4 h-4" />
            {syncing ? 'Syncing...' : 'Sync All'}
          </Button>
        </div>
      </Card>

      {error && (
        <Card className="mb-lg p-lg">
          <p className="sf-body text-apple-red">{error}</p>
        </Card>
      )}

      {loading ? (
        <Card className="p-xl text-center">
          <LoadingSpinner />
          <p className="sf-body mt-md">Loading source health...</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          {data?.sources.map((source) => (
            <SourceCard key={source.source_id} source={source} />
          ))}
        </div>
      )}
    </div>
  )
}
