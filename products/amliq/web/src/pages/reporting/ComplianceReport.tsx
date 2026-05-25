import { useState, useEffect } from 'react'
import { api } from '../../api/client'
import { ComplianceCards } from '../../components/reporting/ComplianceCards'
import { ComplianceTrend } from '../../components/reporting/ComplianceTrend'

interface Metrics {
  screenings_performed: number; alerts_generated: number;
  cases_opened: number; cases_closed: number; sars_filed: number;
  false_positive_rate: number; avg_resolution_hours: number;
}

const defaultMetrics: Metrics = {
  screenings_performed: 0, alerts_generated: 0,
  cases_opened: 0, cases_closed: 0, sars_filed: 0,
  false_positive_rate: 0, avg_resolution_hours: 0,
}

export function ComplianceReport() {
  const [metrics, setMetrics] = useState<Metrics>(defaultMetrics)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<Metrics>('/reports/dashboard')
      .then(d => setMetrics(d ?? defaultMetrics))
      .catch(() => setMetrics(defaultMetrics))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="px-md py-lg sm:p-8 max-w-6xl mx-auto">
        <p className="text-center py-12" style={{ color: 'var(--dash-text-secondary)' }}>Loading report...</p>
      </div>
    )
  }

  return (
    <div className="px-md py-lg sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold sf-title">Monthly Compliance Report</h1>
        <button className="button-secondary w-full sm:w-auto" onClick={() => window.print()}>
          Export as PDF
        </button>
      </div>
      <ComplianceCards metrics={metrics} />
      <ComplianceTrend metrics={metrics} />
    </div>
  )
}
