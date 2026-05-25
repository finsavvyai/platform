interface FeatureCardProps {
  icon: string
  title: string
  desc: string
  tags?: string[]
}

export function FeatureCard({ icon, title, desc, tags }: FeatureCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 hover:border-emerald-500/30 transition">
      <div className="mb-4 text-2xl">{icon}</div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{desc}</p>
      {tags && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
