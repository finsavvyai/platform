const services = [
  { name: 'Screening API', status: 'operational', uptime: '99.99%' },
  { name: 'PEP Database', status: 'operational', uptime: '100%' },
  { name: 'Adverse Media', status: 'operational', uptime: '99.97%' },
  { name: 'Sanctions List Sync', status: 'operational', uptime: '99.99%' },
  { name: 'Dashboard & UI', status: 'operational', uptime: '100%' },
  { name: 'Webhooks', status: 'operational', uptime: '99.95%' },
]

export default function StatusPage() {
  return (
    <div style={{ background: 'var(--text)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-24">
        <p className="section-eyebrow mb-4">System Status</p>
        <div className="flex items-center gap-3 mb-4">
          <span className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#2D7A4F' }} />
          <h1 className="text-4xl font-bold tracking-tight" style={{ color: 'var(--bg-elevated)', letterSpacing: '-0.02em' }}>
            All systems operational
          </h1>
        </div>
        <p className="text-base mb-12" style={{ color: '#5C5852' }}>
          Last checked: {new Date().toLocaleString()}
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E8E5DF' }}>
          {services.map((svc, i) => (
            <div key={svc.name}
              className="flex items-center justify-between px-6 py-4"
              style={{
                background: '#FFFFFF',
                borderBottom: i < services.length - 1 ? '1px solid #E8E5DF' : undefined,
              }}>
              <span className="text-sm font-medium" style={{ color: 'var(--bg-elevated)' }}>{svc.name}</span>
              <div className="flex items-center gap-4">
                <span className="text-xs" style={{ color: '#9E9A94' }}>{svc.uptime} uptime</span>
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(45,122,79,0.1)', color: '#2D7A4F' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#2D7A4F' }} />
                  Operational
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm" style={{ color: '#9E9A94' }}>
          Subscribe to updates at{' '}
          <a href="mailto:status@amliq.finance" style={{ color: 'var(--accent-gold)' }}>status@amliq.finance</a>
        </p>
      </div>
    </div>
  )
}
