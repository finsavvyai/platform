import { type LucideIcon } from 'lucide-react'

interface TrustSectionProps {
  icon: LucideIcon
  title: string
  items: string[]
}

export default function TrustSection({ icon: Icon, title, items }: TrustSectionProps) {
  return (
    <div className="rounded-lg border border-token-line bg-token-surface p-6 sm:p-8">
      <div className="flex items-center gap-3 mb-4">
        <Icon size={20} className="text-token-gold flex-shrink-0" />
        <h2 className="text-lg font-semibold text-token-fg">{title}</h2>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed text-token-fg-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
