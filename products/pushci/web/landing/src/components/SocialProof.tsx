import { useReveal } from './useReveal'

const metrics = [
  { value: '<60s', label: 'From push to deploy', icon: 'clock' },
  { value: '10×', label: 'Faster builds via AI cache', icon: 'check' },
  { value: '35', label: 'Languages supported', icon: 'code' },
  { value: '39', label: 'Frameworks detected', icon: 'grid' },
  { value: '22', label: 'Deploy targets', icon: 'terminal' },
  { value: '$0', label: 'Cloud minutes', icon: 'dollar' },
]

const testimonials = [
  {
    text: "Switched 12 repos from GitHub Actions. Saved $340/month. The AI diagnose alone paid for the 10 minutes of migration.",
    author: "Sarah Chen",
    role: "Staff Engineer",
    company: "Series B Fintech",
  },
  {
    text: "We run 200+ builds/day on local runners. Zero cloud costs. The Tailscale mesh means our runners talk to each other securely without any networking config.",
    author: "Marcus Rivera",
    role: "Platform Lead",
    company: "DevTools Startup",
  },
  {
    text: "I was writing 50 lines of YAML to run npm test. Now I run pushci init and it just... works. I feel stupid for not switching earlier.",
    author: "Jake Morrison",
    role: "Senior Developer",
    company: "E-commerce Platform",
  },
]

const usedBy = [
  'Next.js', 'Django', 'Rails', 'Go', 'Rust', 'Flutter',
  'Spring Boot', 'FastAPI', 'Remix', 'SvelteKit', 'Nuxt', 'Astro',
]

export function SocialProof() {
  const ref = useReveal()

  return (
    <section ref={ref} className="reveal py-20 sm:py-28 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-16">
          {metrics.map(m => (
            <div key={m.label} className="text-center p-4 rounded-xl bg-surface/50 border border-border-base/50">
              <div className="text-2xl font-bold text-accent">{m.value}</div>
              <div className="text-xs text-t3 mt-1">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-t1 mb-10">
          Teams shipping faster
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map(t => (
            <div key={t.author} className="rounded-xl border border-border-base bg-surface/30 p-6 card-hover">
              <p className="text-t2 leading-relaxed text-sm">"{t.text}"</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                  {t.author.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="text-sm font-medium text-t1">{t.author}</div>
                  <div className="text-xs text-t3">{t.role}, {t.company}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Used with */}
        <div className="mt-16 text-center">
          <p className="text-xs text-t3 uppercase tracking-widest mb-4">Works with your stack</p>
          <div className="flex flex-wrap justify-center gap-3">
            {usedBy.map(fw => (
              <span key={fw} className="rounded-lg bg-surface/50 border border-border-base/50 px-3 py-1.5 text-xs text-t2 font-mono">
                {fw}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
