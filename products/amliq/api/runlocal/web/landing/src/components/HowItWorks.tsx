const steps = [
  {
    num: '01',
    title: 'npx pushci init',
    desc: 'AI scans your repo, detects frameworks, languages, databases, and test suites. Generates your pipeline in seconds.',
    code: '$ npx pushci init',
  },
  {
    num: '02',
    title: 'git push',
    desc: 'Push your code. PushCI intercepts the push, runs your build and tests locally before they hit the remote.',
    code: '$ git push origin main',
  },
  {
    num: '03',
    title: 'Merge & Deploy',
    desc: 'Merge your PR. PushCI auto-deploys to your configured cloud target -- AWS, Vercel, Cloudflare, or anywhere.',
    code: '$ pushci deploy --prod',
  },
]

export function HowItWorks() {
  return (
    <section id="docs" className="py-24 px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          Three commands. That's it.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-zinc-400">
          No YAML. No config files. No 200-line workflows.
        </p>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.num}
              className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-emerald-500/40 transition"
            >
              <span className="text-xs font-bold text-emerald-400">{s.num}</span>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
              <div className="mt-4 rounded-lg bg-zinc-950 px-4 py-3 font-mono text-xs text-emerald-400">
                {s.code}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
