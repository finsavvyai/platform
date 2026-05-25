interface Metrics {
  screenings_performed: number; alerts_generated: number;
  cases_opened: number; cases_closed: number; sars_filed: number;
  false_positive_rate: number; avg_resolution_hours: number;
}

export function ComplianceCards({ metrics }: { metrics: Metrics }) {
  const cards = [
    { label: 'Screenings Performed', value: metrics.screenings_performed },
    { label: 'Alerts Generated', value: metrics.alerts_generated },
    { label: 'Cases Opened', value: metrics.cases_opened },
    { label: 'Cases Closed', value: metrics.cases_closed },
    { label: 'SARs Filed', value: metrics.sars_filed },
    { label: 'False Positive Rate', value: `${(metrics.false_positive_rate * 100).toFixed(1)}%` },
    { label: 'Avg Resolution (hrs)', value: metrics.avg_resolution_hours.toFixed(1) },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {cards.map(c => (
        <div key={c.label} className="card-vibrancy p-4">
          <p className="text-sm" style={{ color: 'var(--dash-text-secondary)' }}>{c.label}</p>
          <p className="text-2xl font-bold mt-1 sf-title">{c.value}</p>
        </div>
      ))}
    </div>
  )
}
