import { Clock, CheckCircle, XCircle, Loader } from 'lucide-react'
import { Badge } from '../ui/Badge'

export function StatusIcon({ status }: { status: string }) {
  const m: Record<string, { c: 'green' | 'red' | 'purple' | 'gray'; I: typeof Clock }> = {
    running: { c: 'purple', I: Loader },
    success: { c: 'green', I: CheckCircle },
    failed: { c: 'red', I: XCircle },
    canceled: { c: 'gray', I: Clock },
  }
  const { c, I } = m[status] ?? m.canceled
  return (
    <Badge size="sm" color={c}>
      <I className="w-3 h-3 mr-1 inline" />{status}
    </Badge>
  )
}
