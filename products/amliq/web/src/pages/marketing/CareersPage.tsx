const openings = [
  { title: 'Senior Backend Engineer', dept: 'Engineering', loc: 'Remote' },
  { title: 'Compliance Solutions Engineer', dept: 'Solutions', loc: 'New York / Remote' },
  { title: 'Product Manager – Screening', dept: 'Product', loc: 'Remote' },
  { title: 'Enterprise Account Executive', dept: 'Sales', loc: 'London / Remote' },
]

export default function CareersPage() {
  return (
    <div style={{ background: 'var(--text)', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 pt-24 pb-24">
        <p className="section-eyebrow mb-4">Careers</p>
        <h1 className="text-4xl font-bold tracking-tight mb-6" style={{ color: 'var(--bg-elevated)', letterSpacing: '-0.02em' }}>
          Build the future of compliance
        </h1>
        <p className="text-lg mb-16 max-w-xl" style={{ color: '#5C5852' }}>
          We're a small, focused team building infrastructure that financial institutions rely on. Join us.
        </p>
        <div className="space-y-4">
          {openings.map(job => (
            <div key={job.title} className="flex items-center justify-between p-5 rounded-xl"
              style={{ background: '#FFFFFF', border: '1px solid #E8E5DF' }}>
              <div>
                <p className="font-semibold text-sm mb-1" style={{ color: 'var(--bg-elevated)' }}>{job.title}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--accent-gold-light)', color: 'var(--accent-gold)' }}>{job.dept}</span>
                  <span className="text-xs" style={{ color: '#9E9A94' }}>{job.loc}</span>
                </div>
              </div>
              <a href="mailto:careers@amliq.finance"
                className="text-xs font-semibold px-4 py-2 rounded-lg"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text)' }}>
                Apply
              </a>
            </div>
          ))}
        </div>
        <p className="mt-12 text-sm" style={{ color: '#9E9A94' }}>
          Don't see your role? Email us at{' '}
          <a href="mailto:careers@amliq.finance" style={{ color: 'var(--accent-gold)' }}>careers@amliq.finance</a>
        </p>
      </div>
    </div>
  )
}
