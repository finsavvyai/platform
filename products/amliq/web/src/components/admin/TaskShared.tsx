import { Clock, CheckCircle, XCircle, Loader } from 'lucide-react'
import { Badge } from '../ui/Badge'

type TaskStatus = 'running' | 'success' | 'failed' | 'canceled'

const statusMap = {
  running:  { color: 'orange' as const, Icon: Loader },
  success:  { color: 'green' as const, Icon: CheckCircle },
  failed:   { color: 'red' as const, Icon: XCircle },
  canceled: { color: 'gray' as const, Icon: Clock },
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { color, Icon } = statusMap[status] ?? statusMap.canceled
  return (
    <Badge size="sm" color={color}>
      <Icon className="w-3 h-3 mr-1 inline" />{status}
    </Badge>
  )
}

export function formatDuration(ms: number): string {
  if (!ms) return '--'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
