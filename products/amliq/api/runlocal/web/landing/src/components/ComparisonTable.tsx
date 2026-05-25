interface Feature {
  name: string
  pushci: string
  competitor: string
}

interface ComparisonTableProps {
  features: Feature[]
  competitorName: string
}

function Check() {
  return <span className="text-emerald-400 font-bold">&#10003;</span>
}

function Cross() {
  return <span className="text-zinc-500">&#10007;</span>
}

function CellValue({ value }: { value: string }) {
  if (value === 'yes') return <Check />
  if (value === 'no') return <Cross />
  return <span className="text-zinc-300 text-sm">{value}</span>
}

export function ComparisonTable({ features, competitorName }: ComparisonTableProps) {
  return (
    <section id="compare" className="py-16 px-6">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl font-bold text-white text-center mb-8">
          Feature Comparison
        </h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/50">
                <th className="px-6 py-4 text-sm font-semibold text-zinc-400">Feature</th>
                <th className="px-6 py-4 text-sm font-semibold text-emerald-400">PushCI</th>
                <th className="px-6 py-4 text-sm font-semibold text-zinc-400">{competitorName}</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={f.name} className={i % 2 === 0 ? 'bg-zinc-900/30' : ''}>
                  <td className="px-6 py-3 text-sm text-zinc-300">{f.name}</td>
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
