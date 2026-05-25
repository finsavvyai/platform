import { Badge } from '../ui/Badge'
import { toStringArray } from '../../types/screening'
import type { ScreenMatch } from '../../types'

interface Props {
  match: ScreenMatch
}

export function MatchSanctionsInfo({ match }: Props) {
  const { sanctions, remarks, sourceUrl, source_url } = match
  const url = sourceUrl ?? source_url
  const programs = toStringArray(match.programs)
  const hasSanctions = Array.isArray(sanctions) ? sanctions.length > 0 : !!(sanctions && String(sanctions).trim())
  const hasPrograms = programs.length > 0
  const hasRemarks = !!(remarks && String(remarks).trim())
  if (!hasSanctions && !hasPrograms && !hasRemarks && !url) return null

  return (
    <section className="border-t pt-md space-y-sm" style={{ borderColor: 'var(--dash-border)' }}>
      <h4 className="sf-caption font-semibold uppercase tracking-wider"
        style={{ color: 'var(--dash-text-secondary)' }}>
        Sanctions & Programs
      </h4>

      {hasPrograms && (
        <div className="flex flex-wrap gap-xs">
          {programs.map((p) => (
            <Badge key={p} color="red" size="sm">{p}</Badge>
          ))}
        </div>
      )}

      {typeof sanctions === 'string' && sanctions && (
        <p className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>{sanctions}</p>
      )}

      {Array.isArray(sanctions) && sanctions.map((s: any, i: number) => (
        <div key={i} className="border-l-2 pl-3 space-y-0.5"
          style={{ borderColor: 'var(--danger)' }}>
          {s.authority && (
            <p className="sf-caption font-medium" style={{ color: 'var(--dash-text)' }}>{s.authority}</p>
          )}
          {s.program && (
            <p className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>{s.program}</p>
          )}
          {s.reason && (
            <p className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>{s.reason}</p>
          )}
        </div>
      ))}

      {hasRemarks && (
        <p className="sf-caption rounded-lg p-3" style={{
          color: 'var(--dash-text-secondary)',
          background: 'var(--dash-surface-secondary, var(--dash-bg))',
        }}>{remarks}</p>
      )}

      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="sf-caption inline-block hover:underline"
          style={{ color: 'var(--dash-accent)' }}>
          View source →
        </a>
      )}
    </section>
  )
}
