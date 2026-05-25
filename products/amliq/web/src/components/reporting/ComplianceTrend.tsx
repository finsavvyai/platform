interface Metrics {
  alerts_generated: number; avg_resolution_hours: number;
  screenings_performed: number; cases_opened: number;
  cases_closed: number; sars_filed: number; false_positive_rate: number;
}

export function ComplianceTrend({ metrics }: { metrics: Metrics }) {
  return (
    <>
      <div className="card-vibrancy p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">Screening Trend</h2>
        <div className="h-32 flex items-end gap-1">
          {Array.from({ length: 12 }, (_, i) => {
            const h = Math.max(8, Math.random() * 100)
            return (
              <div key={i} className="flex-1 rounded-t"
                style={{ background: 'rgba(201,169,110,0.6)', height: `${h}%` }} title={`Month ${i + 1}`} />
            )
          })}
        </div>
        <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--dash-text-secondary)' }}>
          <span>Jan</span><span>Jun</span><span>Dec</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-vibrancy p-6">
          <h2 className="text-lg font-medium mb-3">Alert Volume</h2>
          <p className="text-3xl font-bold sf-title">{metrics.alerts_generated}</p>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-text-secondary)' }}>Total this period</p>
        </div>
        <div className="card-vibrancy p-6">
          <h2 className="text-lg font-medium mb-3">Resolution Time</h2>
          <p className="text-3xl font-bold sf-title">{metrics.avg_resolution_hours.toFixed(1)}h</p>
          <p className="text-sm mt-1" style={{ color: 'var(--dash-text-secondary)' }}>Average per case</p>
        </div>
      </div>
    </>
  )
}
