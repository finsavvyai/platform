import { Badge } from '../ui/Badge'
import type { ScreenMatch } from '../../types'

interface Props {
  match: ScreenMatch
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-sm">
      <span className="sf-caption w-28 shrink-0" style={{ color: 'var(--dash-text-tertiary)' }}>{label}</span>
      <span className="sf-body break-words min-w-0" style={{ color: 'var(--dash-text)' }}>{value}</span>
    </div>
  )
}

function pick(match: ScreenMatch, camel: keyof ScreenMatch, snake: keyof ScreenMatch): string | undefined {
  const v = (match[camel] ?? match[snake]) as unknown
  if (typeof v !== 'string') return undefined
  return v.trim() ? v : undefined
}

function fmtDate(iso?: string): string | undefined {
  if (!iso) return undefined
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) }
  catch { return iso }
}

export function MatchEntityInfo({ match }: Props) {
  const fullName = [match.given_name, match.family_name].filter(Boolean).join(' ')
  const birthPlace = pick(match, 'birthPlace', 'birth_place')
  const birthCountry = pick(match, 'birthCountry', 'birth_country')
  const dataset = match.dataset
  const schemaType = pick(match, 'schemaType', 'schema_type')
  const pepTier = pick(match, 'pepTier', 'pep_tier')
  const originalScript = match.original_script ?? (match.metadata?.original_script as string | undefined)
  const firstSeen = fmtDate(pick(match, 'firstSeen', 'first_seen'))
  const lastSeen = fmtDate(pick(match, 'lastSeen', 'last_seen'))
  const lastChange = fmtDate(pick(match, 'lastChange', 'last_change'))
  const listingDate = fmtDate(pick(match, 'listingDate', 'listing_date'))

  const rows: { label: string; value: string }[] = []
  if (fullName) rows.push({ label: 'Name', value: fullName })
  if (match.date_of_birth) rows.push({ label: 'Date of Birth', value: match.date_of_birth })
  if (match.gender) rows.push({ label: 'Gender', value: match.gender })
  if (birthPlace || birthCountry) {
    const parts = [birthPlace, birthCountry ? birthCountry.toUpperCase() : undefined].filter(Boolean)
    rows.push({ label: 'Birth Place', value: parts.join(', ') })
  }
  if (match.position) rows.push({ label: 'Position', value: match.position })
  if (dataset) rows.push({ label: 'Dataset', value: dataset })
  if (schemaType) rows.push({ label: 'Schema', value: schemaType })
  if (listingDate) rows.push({ label: 'Listed', value: listingDate })

  const hasNationalities = !!(match.nationalities && match.nationalities.length > 0)
  const hasTimestamps = firstSeen || lastSeen || lastChange
  if (rows.length === 0 && !hasNationalities && !originalScript && !pepTier && !hasTimestamps) return null

  return (
    <section className="border-t pt-md space-y-xs" style={{ borderColor: 'var(--dash-border)' }}>
      {rows.map((r) => <InfoRow key={r.label} label={r.label} value={r.value} />)}
      {originalScript && originalScript.trim() && (
        <InfoRow label="Script" value={originalScript} />
      )}
      {pepTier && <InfoRow label="PEP Tier" value={pepTier} />}
      {hasNationalities && (
        <div className="flex items-center gap-sm flex-wrap">
          <span className="sf-caption w-28 shrink-0" style={{ color: 'var(--dash-text-tertiary)' }}>Nationality</span>
          {match.nationalities!.map((nat) => <Badge key={nat} color="gray" size="sm">{nat.toUpperCase()}</Badge>)}
        </div>
      )}
      {hasTimestamps && (
        <div className="flex items-baseline gap-sm">
          <span className="sf-caption w-28 shrink-0" style={{ color: 'var(--dash-text-tertiary)' }}>Record</span>
          <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>
            {firstSeen && `First seen: ${firstSeen}`}
            {firstSeen && lastSeen && ' · '}
            {lastSeen && `Last seen: ${lastSeen}`}
            {(firstSeen || lastSeen) && lastChange && ' · '}
            {lastChange && `Updated: ${lastChange}`}
          </span>
        </div>
      )}
    </section>
  )
}
