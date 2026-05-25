import { rows } from './comparisonData'

const headers = ['', 'PushCI', 'GitHub Actions', 'GitLab CI', 'CircleCI']

export function Comparison() {
  return (
    <section className="py-24 px-6 border-t border-zinc-800/50">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          How we compare
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-zinc-400">
          PushCI replaces cloud CI with local-first, AI-powered pipelines.
        </p>
        <div className="mt-16 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {headers.map((h, i) => (
                  <th
                    key={h || 'label'}
                    className={`py-3 px-4 text-left font-medium ${
                      i === 1 ? 'text-emerald-400' : 'text-zinc-400'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-zinc-800/50">
                  <td className="py-3 px-4 font-medium text-zinc-300">{r.label}</td>
                  <td className="py-3 px-4 text-emerald-400 font-medium">{r.pushci}</td>
                  <td className="py-3 px-4 text-zinc-500">{r.github}</td>
                  <td className="py-3 px-4 text-zinc-500">{r.gitlab}</td>
                  <td className="py-3 px-4 text-zinc-500">{r.circle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
