import { StatusIcon } from './StatusIcon'
import { fmtMs } from './fmtMs'

interface TaskEntry {
  id: string; task_name: string; trigger: string;
  status: 'running' | 'success' | 'failed' | 'canceled';
  started_at: string; duration_ms: number;
}

export function TaskMobileList({ tasks }: { tasks: TaskEntry[] }) {
  return (
    <div className="space-y-sm">
      {tasks.map(t => (
        <div key={t.id} className="glass-panel rounded-apple-lg p-lg">
          <div className="flex items-center justify-between mb-xs">
            <span className="font-medium text-sm">{t.task_name}</span>
            <StatusIcon status={t.status} />
          </div>
          <span className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
            {fmtMs(t.duration_ms)} &middot; {new Date(t.started_at).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
