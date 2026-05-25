import { Badge } from '../ui/Badge'
import { StatusBadge, formatDuration } from './TaskShared'
import type { TaskEntry } from '../../pages/admin/ScheduledTasks'

export function TaskCardList({ tasks }: { tasks: TaskEntry[] }) {
  return (
    <div className="space-y-sm">
      {tasks.map(t => (
        <div key={t.id} className="glass-panel rounded-apple-lg p-lg">
          <div className="flex items-center justify-between mb-sm">
            <span className="font-medium text-sm">{t.task_name}</span>
            <StatusBadge status={t.status} />
          </div>
          <div className="flex items-center gap-sm mb-xs">
            <Badge size="sm" color={t.trigger === 'manual' ? 'orange' : 'gray'}>
              {t.trigger}
            </Badge>
            <span className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
              {formatDuration(t.duration_ms)}
            </span>
          </div>
          {(t.output || t.error) && (
            <p className="sf-caption mt-xs truncate"
              style={{ color: 'var(--dash-text-tertiary)' }}>
              {t.error || t.output}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
