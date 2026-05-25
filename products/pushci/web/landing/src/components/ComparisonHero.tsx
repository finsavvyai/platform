interface ComparisonHeroProps {
  title: string
  subtitle: string
  competitor: string
}

export function ComparisonHero({ title, subtitle, competitor }: ComparisonHeroProps) {
  return (
    <section className="pt-28 sm:pt-36 pb-12 sm:pb-16 px-4 sm:px-6">
      <div className="mx-auto max-w-[1080px]">
        <p className="text-body font-medium text-accent tracking-wide">
          vs {competitor}
        </p>
        <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-t1 max-w-2xl">
          {title}
        </h1>
        <p className="mt-4 text-lg text-t2 max-w-xl leading-relaxed">
          {subtitle}
        </p>
        <a
          href="#compare"
          className="mt-8 inline-block rounded-lg bg-t1 px-6 py-3 text-sm font-semibold text-root hover:bg-white transition-colors duration-200 focus-glow"
        >
          See the Comparison
        </a>
      </div>
    </section>
  )
}
