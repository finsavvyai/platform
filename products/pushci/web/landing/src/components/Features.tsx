import { Link } from 'react-router-dom'
import { FeatureCard } from './FeatureCard'
import { features } from './featuresData'
import { useReveal } from './useReveal'
import { ViralShare } from './ViralShare'

export function Features() {
  const ref = useReveal()

  return (
    <section id="features" ref={ref} className="reveal py-20 sm:py-32 px-4 sm:px-6 section-border">
      <div className="mx-auto max-w-[1080px]">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-t1">
          Built for how you work
        </h2>
        <p className="mt-3 text-t2 max-w-lg">
          Everything you need to ship. Nothing to configure.
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          <Link to="/skills" className="text-t2 hover:text-t1 transition-colors duration-200 underline underline-offset-4 decoration-border-base">
            Browse 24+ skills
          </Link>
          <Link to="/ai" className="text-t2 hover:text-t1 transition-colors duration-200 underline underline-offset-4 decoration-border-base">
            AI agent integration
          </Link>
        </div>
        <div className="mt-10 max-w-xl">
          <ViralShare context="Know a dev drowning in config?" />
        </div>
      </div>
    </section>
  )
}
