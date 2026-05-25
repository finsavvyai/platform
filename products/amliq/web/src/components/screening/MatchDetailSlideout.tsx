import { useEffect, useRef } from 'react'
import { MatchDetailHeader } from './MatchDetailHeader'
import { MatchEntityInfo } from './MatchEntityInfo'
import { MatchEvidenceBars } from './MatchEvidenceBars'
import { MatchSanctionsInfo } from './MatchSanctionsInfo'
import { MatchContactInfo } from './MatchContactInfo'
import { MatchIdentifiers } from './MatchIdentifiers'
import { MatchMetadata } from './MatchMetadata'
import { toStringArray } from '../../types/screening'
import type { ScreenMatch } from '../../types'

interface Props {
  match: ScreenMatch
  open: boolean
  onClose: () => void
}

function hasEntityInfo(m: ScreenMatch): boolean {
  return !!(
    m.given_name || m.family_name || m.date_of_birth || m.gender || m.position ||
    m.nationalities?.length || m.first_seen || m.last_seen || m.last_change ||
    m.firstSeen || m.lastSeen || m.lastChange || m.listingDate || m.listing_date ||
    m.birthPlace || m.birth_place || m.birthCountry || m.birth_country ||
    m.dataset || m.schemaType || m.schema_type || m.pepTier || m.pep_tier ||
    m.original_script || (m.metadata?.original_script as string | undefined)
  )
}

function hasIdentifiers(m: ScreenMatch): boolean {
  const aliases = toStringArray(m.aliases)
  const ids = m.identifiers
  return aliases.length > 0 || !!(ids && (Array.isArray(ids) ? ids.length : String(ids).trim()))
}

function hasSanctionsInfo(m: ScreenMatch): boolean {
  const programs = toStringArray(m.programs)
  return !!(m.sanctions || programs.length || (m.remarks && String(m.remarks).trim()) || m.sourceUrl || m.source_url)
}

function hasContactInfo(m: ScreenMatch): boolean {
  return (
    toStringArray(m.emails).length +
    toStringArray(m.phones).length +
    toStringArray(m.websites).length +
    toStringArray(m.addresses).length
  ) > 0
}

function hasMetadataContent(m: ScreenMatch): boolean {
  const meta = { ...(m.metadata ?? {}), ...((m.extendedData ?? m.extended_data ?? {}) as Record<string, unknown>) }
  return Object.keys(meta).length > 0
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t pt-md" style={{ borderColor: 'var(--dash-border)' }}>
      {children}
    </div>
  )
}

export function MatchDetailSlideout({ match, open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open || !match) return null

  const meta = {
    ...(match.metadata ?? {}),
    ...((match.extendedData ?? match.extended_data ?? {}) as Record<string, unknown>),
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose} />
      <div ref={panelRef}
        className="relative w-full max-w-2xl h-full overflow-y-auto shadow-2xl animate-slide-in-right"
        style={{ background: 'var(--dash-surface)' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 backdrop-blur-md border-b"
          style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}>
          <h2 className="sf-caption font-semibold" style={{ color: 'var(--dash-text-secondary)' }}>
            Match Details
          </h2>
          <button onClick={onClose} className="sf-headline px-2 py-1 rounded transition-colors hover:opacity-70"
            style={{ color: 'var(--dash-text-tertiary)' }}>×</button>
        </div>
        <div className="p-6 space-y-lg">
          <MatchDetailHeader match={match} />
          {hasEntityInfo(match) && <Divider><MatchEntityInfo match={match} /></Divider>}
          {hasIdentifiers(match) && <Divider><MatchIdentifiers match={match} /></Divider>}
          {hasSanctionsInfo(match) && <Divider><MatchSanctionsInfo match={match} /></Divider>}
          {hasContactInfo(match) && <Divider><MatchContactInfo match={match} /></Divider>}
          {!!(match.layers?.length) && <Divider><MatchEvidenceBars layers={match.layers} /></Divider>}
          {match.explanation && (
            <p className="sf-caption italic border-t pt-md"
              style={{ color: 'var(--dash-text-tertiary)', borderColor: 'var(--dash-border)' }}>
              {match.explanation}
            </p>
          )}
          {hasMetadataContent(match) && <Divider><MatchMetadata metadata={meta} /></Divider>}
        </div>
      </div>
    </div>
  )
}
