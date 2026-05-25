import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/PageHeader'

interface HealthData { status: string; version: string; time: string }
interface ReadyData { ready: boolean; database: string }

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export function SystemHealth() {
  const { t } = useTranslation('admin')
  const [health, setHealth] = useState<HealthData | null>(null)
  const [ready, setReady] = useState<ReadyData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/health`).then(r => r.json()),
      fetch(`${API_BASE}/ready`).then(r => r.json()),
    ])
      .then(([h, r]) => {
        setHealth(h.data ?? h ?? null)
        setReady(r.data ?? r ?? null)
      })
      .catch(() => setError(t('health.fetch_error')))
  }, [])

  if (error) return <p className="p-xl text-red-500 sf-body">{error}</p>

  return (
    <div>
      <PageHeader title={t('health.title')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-lg">
        <StatusCard title={t('health.api_status')}
          value={health?.status ?? 'loading'} ok={health?.status === 'healthy'} />
        <StatusCard title={t('health.database')}
          value={ready?.database ?? 'loading'} ok={ready?.database === 'connected'} />
        <StatusCard title={t('health.version')}
          value={health?.version ?? '-'} ok={true} />
      </div>
    </div>
  )
}

function StatusCard({ title, value, ok }: {
  title: string; value: string; ok: boolean
}) {
  const color = ok ? 'text-emerald-500' : 'text-red-500'
  const bg = ok ? 'bg-emerald-500/10' : 'bg-red-500/10'
  return (
    <div className={`glass-card p-xl rounded-apple-lg ${bg}`}>
      <p className="sf-caption mb-xs" style={{ color: 'var(--dash-text-secondary)' }}>{title}</p>
      <p className={`sf-headline text-xl ${color}`}>{value}</p>
    </div>
  )
}

export default SystemHealth
