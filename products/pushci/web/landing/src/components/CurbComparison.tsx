import { useReveal } from './useReveal'

const rows = [
  { label: 'Cost', cloud: '"Depends..." ', pushci: '$0', cloudEmoji: '', pushciEmoji: '' },
  { label: 'Speed', cloud: '"Queued..."', pushci: 'Immediate', cloudEmoji: '', pushciEmoji: '' },
  { label: 'Config', cloud: '50 lines of YAML', pushci: 'Zero', cloudEmoji: '', pushciEmoji: '' },
  { label: 'Control', cloud: 'Limited', pushci: 'Yours', cloudEmoji: '', pushciEmoji: '' },
  { label: 'Debugging', cloud: 'Good luck', pushci: 'It\'s your machine', cloudEmoji: '', pushciEmoji: '' },
  { label: 'Emotional damage', cloud: 'High', pushci: 'Still high, but free', cloudEmoji: '', pushciEmoji: '' },
]

export function CurbComparison() {
  const ref = useReveal()

  return (
    <section ref={ref} className="reveal py-20 sm:py-32 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-t1">
          Honest comparison
        </h2>
        <p className="mt-3 text-t3 max-w-md italic">
          No marketing spin. Just the uncomfortable truth.
        </p>

        <div className="mt-10 rounded-lg border border-border-base overflow-hidden">
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border-base bg-surface/40">
                <th className="py-3 px-5 text-left text-t3 font-medium w-1/3"></th>
                <th className="py-3 px-5 text-left text-t3 font-medium">Cloud CI</th>
                <th className="py-3 px-5 text-left text-accent font-medium">pushci.dev</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-border-base/40 last:border-0">
                  <td className="py-4 px-5 text-t2 font-medium">{r.label}</td>
                  <td className="py-4 px-5 text-t3">{r.cloud}</td>
                  <td className="py-4 px-5 text-accent">{r.pushci}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
