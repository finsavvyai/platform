interface FeatureCardProps {
  title: string
  desc: string
  tags?: string[]
}

export function FeatureCard({ title, desc, tags }: FeatureCardProps) {
  return (
    <div className="rounded-lg border border-border-base bg-surface p-6 card-hover">
      <h3 className="text-section text-t1">{title}</h3>
      <p className="mt-2 text-body text-t3 leading-relaxed">{desc}</p>
      {tags && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded bg-raised px-2 py-0.5 text-caption text-t2"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
