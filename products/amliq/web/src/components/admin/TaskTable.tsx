import { Badge } from '../ui/Badge'
import { StatusBadge, formatDuration } from './TaskShared'
import type { TaskEntry } from '../../pages/admin/ScheduledTasks'

export function TaskTable({ tasks }: { tasks: TaskEntry[] }) {
  return (
    <div className="glass-panel rounded-apple-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b"
            style={{ color: 'var(--dash-text-secondary)', borderColor: 'var(--dash-border)' }}>
            <th className="px-lg py-md">Task</th>
            <th className="px-lg py-md">Trigger</th>
            <th className="px-lg py-md">Status</th>
            <th className="px-lg py-md">Duration</th>
            <th className="px-lg py-md">Started</th>
            <th className="px-lg py-md">Output</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t.id} className="border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <td className="px-lg py-md font-medium">{t.task_name}</td>
              <td className="px-lg py-md">
                <Badge size="sm" color={t.trigger === 'manual' ? 'orange' : 'gray'}>
                  {t.trigger}
                </Badge>
              </td>
              <td className="px-lg py-md"><StatusBadge status={t.status} /></td>
              <td className="px-lg py-md">{formatDuration(t.duration_ms)}</td>
              <td className="px-lg py-md text-xs" style={{ color: 'var(--dash-text-secondary)' }}>
                {new Date(t.started_at).toLocaleString()}
              </td>
              <td className="px-lg py-md text-xs max-w-[200px] truncate">
                {t.error || t.output || '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
