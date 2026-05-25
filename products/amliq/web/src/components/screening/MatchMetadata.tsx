import { useState } from 'react'

interface Props {
  metadata?: Record<string, unknown>
}

/** Keys already displayed by dedicated sections — skip in raw metadata. */
const PROMOTED_KEYS = new Set([
  'aliases', 'programs', 'addresses', 'identifiers', 'original_script',
  'dataset', 'schemaType', 'schema_type', 'firstSeen', 'first_seen',
  'lastSeen', 'last_seen', 'lastChange', 'last_change',
  'listingDate', 'listing_date', 'birthPlace', 'birth_place',
  'birthCountry', 'birth_country', 'sourceUrl', 'source_url',
  'gender', 'position', 'pepTier', 'pep_tier',
  'emails', 'phones', 'websites', 'sanctions', 'remarks',
])

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

function renderValue(value: unknown): string {
  if (isEmptyValue(value)) return '-'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export function MatchMetadata({ metadata }: Props) {
  const [expanded, setExpanded] = useState(false)
  if (!metadata) return null

  const extraKeys = Object.keys(metadata).filter(
    (k) => !PROMOTED_KEYS.has(k) && !isEmptyValue(metadata[k])
  )
  if (extraKeys.length === 0) return null

  return (
    <section className="border-t pt-md" style={{ borderColor: 'var(--dash-border)' }}>
      <button type="button" onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between cursor-pointer">
        <h4 className="sf-caption font-semibold uppercase tracking-wider"
          style={{ color: 'var(--dash-text-secondary)' }}>
          Additional Data ({extraKeys.length})
        </h4>
        <span className="sf-caption transition-colors"
          style={{ color: 'var(--dash-text-tertiary)' }}>
          {expanded ? 'Hide' : 'Show'}
        </span>
      </button>

      {expanded && (
        <div className="mt-sm space-y-xs animate-fade-in">
          {extraKeys.map((k) => (
            <div key={k} className="flex items-baseline gap-sm py-xs">
              <span className="sf-caption w-32 shrink-0 capitalize"
                style={{ color: 'var(--dash-text-tertiary)' }}>
                {k.replace(/_/g, ' ')}
              </span>
              <span className="sf-caption break-words min-w-0"
                style={{ color: 'var(--dash-text-secondary)' }}>
                {renderValue(metadata[k])}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
