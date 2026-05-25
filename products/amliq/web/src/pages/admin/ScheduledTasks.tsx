import { useState, useEffect } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'
import { TaskTable } from '../../components/admin/TaskTable'
import { TaskCardList } from '../../components/admin/TaskCardList'

export interface TaskEntry {
  id: string
  task_name: string
  tenant_id?: string
  trigger: string
  status: 'running' | 'success' | 'failed' | 'canceled'
  started_at: string
  ended_at?: string
  duration_ms: number
  output?: string
  error?: string
  actor_id?: string
}

export default function ScheduledTasks() {
  const [tasks, setTasks] = useState<TaskEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = () => {
    api.get<{ tasks: TaskEntry[] }>('/admin/tasks?limit=100')
      .then(d => setTasks(d?.tasks ?? []))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchTasks()
    const iv = setInterval(fetchTasks, 10_000)
    return () => clearInterval(iv)
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>
  }

  return (
    <div>
      <PageHeader title="Scheduled Tasks" description={`${tasks.length} task executions`} />
      <div className="hidden md:block"><TaskTable tasks={tasks} /></div>
      <div className="md:hidden"><TaskCardList tasks={tasks} /></div>
      {tasks.length === 0 && (
        <p className="text-center py-xl sf-body" style={{ color: 'var(--dash-text-tertiary)' }}>
          No task executions yet
        </p>
      )}
    </div>
  )
}
