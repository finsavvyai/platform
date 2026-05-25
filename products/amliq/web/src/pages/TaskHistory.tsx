import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../api/client'
import { AlertSettings } from '../components/tasks/AlertSettings'
import { TaskTable } from '../components/tasks/TaskTable'
import { TaskMobileList } from '../components/tasks/TaskMobileList'

interface TaskEntry {
  id: string; task_name: string; trigger: string;
  status: 'running' | 'success' | 'failed' | 'canceled';
  started_at: string; duration_ms: number; output?: string; error?: string;
}

interface AlertCfg {
  email?: string; whatsapp?: string; slack_webhook?: string; enabled: boolean;
}

export function TaskHistory() {
  const [tasks, setTasks] = useState<TaskEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [alertCfg, setAlertCfg] = useState<AlertCfg>({ enabled: false })
  const [showAlerts, setShowAlerts] = useState(false)

  useEffect(() => {
    api.get<{ tasks: TaskEntry[] }>('/tasks?limit=50')
      .then(d => setTasks(d?.tasks ?? []))
      .catch(() => {}).finally(() => setLoading(false))
    api.get<AlertCfg>('/tasks/alerts')
      .then(d => { if (d) setAlertCfg(d) }).catch(() => {})
  }, [])

  const saveAlertCfg = async () => {
    await api.put('/tasks/alerts', alertCfg)
    setShowAlerts(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>
  }

  return (
    <div>
      <PageHeader title="Task History" description="View scheduled task outcomes and set failure alerts" />
      <div className="flex justify-end mb-lg">
        <button onClick={() => setShowAlerts(!showAlerts)}
          className="flex items-center gap-sm px-md py-sm rounded-apple-lg text-sm cursor-pointer min-h-[44px]"
          style={{ background: 'var(--dash-surface)', color: 'var(--dash-text)' }}>
          <Bell className="w-4 h-4" /> Alert Settings
        </button>
      </div>
      {showAlerts && <AlertSettings cfg={alertCfg} onChange={setAlertCfg} onSave={saveAlertCfg} />}
      <div className="hidden md:block"><TaskTable tasks={tasks} /></div>
      <div className="md:hidden"><TaskMobileList tasks={tasks} /></div>
      {tasks.length === 0 && (
        <p className="text-center py-xl sf-body" style={{ color: 'var(--dash-text-tertiary)' }}>
          No task history available
        </p>
      )}
    </div>
  )
}

export default TaskHistory
