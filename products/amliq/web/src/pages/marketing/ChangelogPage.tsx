const entries = [
  {
    version: 'v2.4.0', date: 'April 10, 2026',
    changes: [
      { type: 'new', text: 'Vessel screening against IMO, OFAC shipping lists' },
      { type: 'new', text: 'Arabic & Hebrew UI with full RTL support' },
      { type: 'improved', text: 'Adverse media processing latency reduced 40%' },
      { type: 'fixed', text: 'PEP result pagination on large datasets' },
    ],
  },
  {
    version: 'v2.3.0', date: 'March 3, 2026',
    changes: [
      { type: 'new', text: 'Crypto wallet screening (BTC, ETH, TRX, SOL)' },
      { type: 'new', text: 'Batch job scheduling and email notifications' },
      { type: 'improved', text: 'Matching algorithm false-positive reduction +15%' },
    ],
  },
  {
    version: 'v2.2.0', date: 'February 12, 2026',
    changes: [
      { type: 'new', text: 'UBO chain visualization' },
      { type: 'new', text: 'EDD workflow with document upload' },
      { type: 'improved', text: 'Dashboard real-time metrics refresh' },
    ],
  },
]

const typeColor: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: 'rgba(61,170,106,0.1)', text: '#2D7A4F', label: 'New' },
  improved: { bg: 'var(--accent-gold-light)', text: 'var(--accent-gold)', label: 'Improved' },
  fixed: { bg: 'color-mix(in srgb, var(--bg) 6%, transparent)', text: '#5C5852', label: 'Fixed' },
}

export default function ChangelogPage() {
  return (
    <div style={{ background: 'var(--text)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-24">
        <p className="section-eyebrow mb-4">Changelog</p>
        <h1 className="text-4xl font-bold tracking-tight mb-12" style={{ color: 'var(--bg-elevated)', letterSpacing: '-0.02em' }}>
          What's new
        </h1>
        <div className="space-y-12">
          {entries.map(entry => (
            <div key={entry.version}>
              <div className="flex items-center gap-4 mb-5">
                <span className="text-sm font-bold px-3 py-1 rounded-full"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--accent-gold)' }}>{entry.version}</span>
                <span className="text-sm" style={{ color: '#9E9A94' }}>{entry.date}</span>
              </div>
              <ul className="space-y-2.5">
                {entry.changes.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm" style={{ color: 'var(--bg-elevated)' }}>
                    <span className="px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0"
                      style={{ background: typeColor[c.type].bg, color: typeColor[c.type].text }}>
                      {typeColor[c.type].label}
                    </span>
                    {c.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
