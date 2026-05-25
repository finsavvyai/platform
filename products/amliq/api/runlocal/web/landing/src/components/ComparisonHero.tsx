interface ComparisonHeroProps {
  title: string
  subtitle: string
  competitor: string
}

export function ComparisonHero({ title, subtitle, competitor }: ComparisonHeroProps) {
  return (
    <section className="relative overflow-hidden pt-32 pb-16 px-6">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 to-zinc-950" />
      <div className="relative mx-auto max-w-4xl text-center">
        <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-400">
          vs {competitor}
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-4 text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          {subtitle}
        </p>
        <a
          href="#compare"
          className="mt-8 inline-block rounded-lg bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400 transition"
        >
          See the Comparison
        </a>
      </div>
    </section>
  )
}
