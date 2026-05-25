interface ComplianceCase {
  id: string
  entity_name: string
  matched_name: string
  status: string
  priority: string
  assigned_to: string
  created_at: string
}

const priorityColor: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-500',
  high: 'bg-amber-500/15 text-amber-500',
  medium: 'bg-[rgba(201,169,110,0.15)] text-[#C9A96E]',
  low: 'bg-emerald-500/15 text-emerald-500',
}

export function CaseCard({ caseItem, t }: {
  caseItem: ComplianceCase
  t: (k: string) => string
}) {
  return (
    <a href={`/compliance/cases/${caseItem.id}`}
      className="block glass-card p-lg hover:bg-white/[0.04] cursor-pointer
        transition-colors rounded-apple-lg">
      <div className="flex justify-between items-start">
        <div>
          <p className="sf-headline">{caseItem.entity_name}</p>
          <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
            {t('cases.matched')} {caseItem.matched_name}
          </p>
          <p className="sf-caption mt-xs" style={{ color: 'var(--dash-text-tertiary)' }}>
            {new Date(caseItem.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-sm">
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            priorityColor[caseItem.priority] || 'bg-white/5'
          }`}>
            {caseItem.priority}
          </span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-white/[0.06]"
            style={{ color: 'var(--dash-text-secondary)' }}>
            {caseItem.status}
          </span>
        </div>
      </div>
    </a>
  )
}
