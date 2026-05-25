import { api } from '../../api/client'
import type { LogLine } from './opsTerminal'

type AddLine = (text: string, type?: LogLine['type']) => void

interface TaskEntry {
  id: string
  task_name: string
  status: 'running' | 'success' | 'failed'
  started_at: string
  ended_at?: string
  duration_ms: number
  output?: string
  error?: string
}

interface OpResult { task_id: string; message: string }

interface FetchTestResult {
  name: string; url: string; status: string
  bytes: number; elapsed: string; error?: string
}

export async function runTaskOp(endpoint: string, name: string, addLine: AddLine) {
  const res = await api.post<OpResult>(endpoint, {})
  addLine(`Task queued: ${res?.task_id ?? 'unknown'}`)
  addLine('Polling for result...')
  await pollTask(res?.task_id ?? '', name, addLine)
}

export async function runDirectOp(endpoint: string, addLine: AddLine) {
  const data = await api.get<{ results: FetchTestResult[]; total: number }>(endpoint)
  if (!data?.results) {
    addLine('No results returned', 'err')
    return
  }
  addLine(`Testing ${data.total} Israeli gov sources...`)
  addLine('')
  for (const r of data.results) {
    if (r.status === 'OK') {
      addLine(`OK   ${r.name}: ${r.bytes} bytes (${r.elapsed})`, 'ok')
    } else {
      addLine(`FAIL ${r.name}: ${r.error ?? 'unknown'} (${r.elapsed})`, 'err')
    }
  }
  addLine('')
  const ok = data.results.filter(r => r.status === 'OK').length
  const fail = data.results.length - ok
  if (fail === 0) {
    addLine(`All ${ok} sources reachable`, 'ok')
  } else {
    addLine(`${ok} OK, ${fail} FAILED out of ${data.results.length}`, 'err')
  }
}

async function pollTask(taskId: string, taskName: string, addLine: AddLine) {
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000))
    try {
      const data = await api.get<{ tasks: TaskEntry[] }>('/admin/tasks?limit=20')
      const task = (data?.tasks ?? []).find(t => t.id === taskId)
      if (!task) { addLine(`Waiting for ${taskName}...`); continue }
      if (task.status === 'running') {
        addLine(`[${taskName}] still running... (${(i + 1) * 2}s)`)
        continue
      }
      if (task.status === 'success') {
        if (task.output) addLine(task.output)
        addLine(`[${taskName}] completed in ${task.duration_ms}ms`, 'ok')
        return
      }
      if (task.status === 'failed') {
        addLine(`[${taskName}] FAILED: ${task.error || 'unknown'}`, 'err')
        return
      }
    } catch {
      addLine('Poll error, retrying...', 'err')
    }
  }
  addLine(`[${taskName}] timed out after 60s`, 'err')
}
