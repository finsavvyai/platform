const costs = [
  { platform: 'GitHub Actions', perRelease: '$0.72-$0.96', yearly: '$37-50/yr' },
  { platform: 'CircleCI', perRelease: '$0.54-$0.72', yearly: '$28-37/yr' },
  { platform: 'PushCI', perRelease: '$0', yearly: '$0' },
]

export function ReleaseCostTable() {
  return (
    <div className="rounded-lg border border-border-base overflow-hidden">
      <table className="w-full text-body">
        <thead>
          <tr className="border-b border-border-base bg-surface/40">
            <th className="py-3 px-5 text-left text-t3 font-medium">Platform</th>
            <th className="py-3 px-5 text-left text-t3 font-medium">Per Release</th>
            <th className="py-3 px-5 text-left text-t3 font-medium">Yearly (52x)</th>
          </tr>
        </thead>
        <tbody>
          {costs.map((c) => (
            <tr key={c.platform} className="border-b border-border-base/40 last:border-0">
              <td className="py-4 px-5 text-t2 font-medium">{c.platform}</td>
              <td className={`py-4 px-5 font-mono ${c.perRelease === '$0' ? 'text-accent' : 'text-t3'}`}>
                {c.perRelease}
              </td>
              <td className={`py-4 px-5 font-mono ${c.yearly === '$0' ? 'text-accent' : 'text-t3'}`}>
                {c.yearly}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
