interface Feature {
  name: string
  pushci: string
  competitor: string
}

interface ComparisonTableProps {
  features: Feature[]
  competitorName: string
}

function CellValue({ value }: { value: string }) {
  if (value === 'yes') return (
    <svg className="w-4 h-4 text-accent" aria-label="Yes" role="img" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
  if (value === 'no') return (
    <svg className="w-4 h-4 text-t3" aria-label="No" role="img" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
  return <span className="text-t2 text-body">{value}</span>
}

export function ComparisonTable({ features, competitorName }: ComparisonTableProps) {
  return (
    <section id="compare" className="py-16 px-4 sm:px-6">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-2xl font-bold text-t1 mb-8">
          Feature comparison
        </h2>

        {/* Mobile card view */}
        <div className="space-y-2 sm:hidden">
          {features.map((f) => (
            <div key={f.name} className="rounded-lg border border-border-base bg-surface p-4">
              <div className="text-body font-medium text-t2 mb-2">{f.name}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-raised px-3 py-2">
                  <span className="text-t3 block text-caption mb-0.5">PushCI</span>
                  <CellValue value={f.pushci} />
                </div>
                <div className="rounded bg-raised px-3 py-2">
                  <span className="text-t3 block text-caption mb-0.5">{competitorName}</span>
                  <CellValue value={f.competitor} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table view */}
        <div className="overflow-x-auto rounded-lg border border-border-base hidden sm:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-base">
                <th className="px-6 py-3 text-caption font-medium text-t3 uppercase tracking-wider">Feature</th>
                <th className="px-6 py-3 text-caption font-medium text-t3 uppercase tracking-wider">PushCI</th>
                <th className="px-6 py-3 text-caption font-medium text-t3 uppercase tracking-wider">{competitorName}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-base/60">
              {features.map((f) => (
                <tr key={f.name} className="hover:bg-surface/30 transition-colors duration-150">
                  <td className="px-6 py-3 text-body text-t2">{f.name}</td>
                  <td className="px-6 py-3"><CellValue value={f.pushci} /></td>
                  <td className="px-6 py-3"><CellValue value={f.competitor} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
