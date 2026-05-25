import { FeatureCard } from './FeatureCard'
import { features } from './featuresData'

export function Features() {
  return (
    <section id="features" className="py-24 px-6 border-t border-zinc-800/50">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          Everything you need. Nothing you don't.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-zinc-400">
          Built for developers who ship fast and hate config files.
        </p>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  )
}
