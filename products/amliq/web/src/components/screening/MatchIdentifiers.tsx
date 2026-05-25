import { Badge } from '../ui/Badge'
import { toStringArray } from '../../types/screening'
import type { ScreenMatch } from '../../types'

interface Props {
  match: ScreenMatch
}

type IdRow = { type: string; value: string; country?: string }

function normalizeIdentifiers(raw: ScreenMatch['identifiers']): IdRow[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw
      .filter((x) => x && typeof x === 'object' && (x.value || x.type))
      .map((x) => ({ type: x.type || 'ID', value: String(x.value ?? ''), country: x.country }))
  }
  // Backend sometimes sends a comma-separated string — split into bare values.
  return toStringArray(raw).map((v) => ({ type: 'ID', value: v }))
}

export function MatchIdentifiers({ match }: Props) {
  const aliases = toStringArray(match.aliases)
  const identifiers = normalizeIdentifiers(match.identifiers)
  if (aliases.length === 0 && identifiers.length === 0) return null

  return (
    <section className="border-t pt-md space-y-sm" style={{ borderColor: 'var(--dash-border)' }}>
      {aliases.length > 0 && (
        <div>
          <h4 className="sf-caption font-semibold uppercase tracking-wider mb-sm"
            style={{ color: 'var(--dash-text-secondary)' }}>
            Aliases
          </h4>
          <div className="flex flex-wrap gap-xs">
            {aliases.map((a) => <Badge key={a} color="gray" size="sm">{a}</Badge>)}
          </div>
        </div>
      )}

      {identifiers.length > 0 && (
        <div>
          <h4 className="sf-caption font-semibold uppercase tracking-wider mb-sm"
            style={{ color: 'var(--dash-text-secondary)' }}>
            Identifiers
          </h4>
          <div className="space-y-xs">
            {identifiers.map((id, i) => (
              <div key={i} className="flex items-baseline gap-sm">
                <Badge color="blue" size="sm">{id.type}</Badge>
                <span className="sf-caption break-all" style={{ color: 'var(--dash-text)' }}>{id.value}</span>
                {id.country && (
                  <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
                    ({id.country.toUpperCase()})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
