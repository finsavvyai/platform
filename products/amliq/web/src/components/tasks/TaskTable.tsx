import { StatusIcon } from './StatusIcon'
import { fmtMs } from './fmtMs'

interface TaskEntry {
  id: string; task_name: string; trigger: string;
  status: 'running' | 'success' | 'failed' | 'canceled';
  started_at: string; duration_ms: number;
}

export function TaskTable({ tasks }: { tasks: TaskEntry[] }) {
  return (
    <div className="glass-panel rounded-apple-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b"
            style={{ color: 'var(--dash-text-secondary)', borderColor: 'var(--dash-border)' }}>
            <th className="px-lg py-md">Task</th>
            <th className="px-lg py-md">Status</th>
            <th className="px-lg py-md">Duration</th>
            <th className="px-lg py-md">Started</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => (
            <tr key={t.id} className="border-b" style={{ borderColor: 'var(--dash-border)' }}>
              <td className="px-lg py-md">{t.task_name}</td>
              <td className="px-lg py-md"><StatusIcon status={t.status} /></td>
              <td className="px-lg py-md">{fmtMs(t.duration_ms)}</td>
              <td className="px-lg py-md text-xs" style={{ color: 'var(--dash-text-secondary)' }}>
                {new Date(t.started_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
