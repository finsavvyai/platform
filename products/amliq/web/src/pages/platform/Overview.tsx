import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/layout/PageHeader'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { api } from '../../api/client'

interface PlatformStats {
  total_tenants: number
  total_screenings: number
}

export default function PlatformOverview() {
  const { t } = useTranslation('platform')
  const [stats, setStats] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<PlatformStats>('/platform/overview')
      .then(d => setStats(d ?? null))
      .catch((err) => setError(err?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center h-96"><LoadingSpinner /></div>
  }

  if (error) {
    return (
      <div className="p-xl text-center">
        <p className="sf-body text-apple-red mb-md">{error}</p>
        <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
          This page requires admin access.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title={t('overview.title')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-lg">
        <StatCard label={t('overview.total_tenants')} value={stats?.total_tenants ?? 0} />
        <StatCard label={t('overview.total_screenings')} value={stats?.total_screenings ?? 0} />
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-vibrancy p-xl">
      <p className="sf-caption mb-xs">{label}</p>
      <p className="text-3xl font-bold sf-title">{value.toLocaleString()}</p>
    </div>
  )
}
