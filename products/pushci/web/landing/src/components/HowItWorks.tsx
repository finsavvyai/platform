import { useReveal } from './useReveal'
import { ViralShare } from './ViralShare'

const steps = [
  {
    num: '1',
    title: 'Initialize',
    command: 'npx pushci init',
    desc: 'AI scans your repo and generates a pipeline. Frameworks, languages, test suites, deploy targets — all detected automatically.',
  },
  {
    num: '2',
    title: 'Push',
    command: 'git push',
    desc: 'PushCI runs your pipeline before code reaches the remote. Build, test, lint — all on your machine, in seconds.',
  },
  {
    num: '3',
    title: 'Ship',
    command: 'pushci deploy',
    desc: 'Deploy to 22 targets. AWS, Vercel, Cloudflare, Kubernetes, Fly.io, Railway, Terraform, Pulumi — one command, any cloud.',
  },
]

export function HowItWorks() {
  const ref = useReveal()

  return (
    <section id="docs" ref={ref} className="reveal py-20 sm:py-32 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-t1">
          How it works
        </h2>
        <p className="mt-3 text-t2 max-w-lg">
          Three steps. No config files, no cloud accounts, no waiting.
        </p>

        <div className="mt-14 grid gap-px md:grid-cols-3 rounded-lg border border-border-base overflow-hidden bg-border-base">
          {steps.map((s, i) => (
            <div key={s.num} className={`bg-root p-6 sm:p-8 reveal-delay-${i + 1}`}>
              <div className="text-caption font-mono text-t3 mb-4">
                Step {s.num}
              </div>
              <h3 className="text-lg font-semibold text-t1">{s.title}</h3>
              <div className="mt-3 rounded-lg bg-surface border border-border-base/60 px-3 py-2 font-mono text-sm text-t2">
                <span className="text-t3">$ </span>{s.command}
              </div>
              <p className="mt-4 text-body text-t3 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-body text-t3">
          Ready to try it?{' '}
          <a href="#pricing" className="text-t1 hover:text-accent transition-colors duration-200 underline underline-offset-4 decoration-border-base">
            See pricing
          </a>
        </p>
        <div className="mt-10 max-w-xl">
          <ViralShare context="Three steps. That's it. Tell someone." />
        </div>
      </div>
    </section>
  )
}
