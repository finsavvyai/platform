import { toStringArray } from '../../types/screening'
import type { ScreenMatch } from '../../types'

interface Props {
  match: ScreenMatch
}

function FieldGroup({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>{label}</span>
      {values.map((v, i) => (
        <p key={i} className="sf-caption mt-0.5 break-words" style={{ color: 'var(--dash-text)' }}>{v}</p>
      ))}
    </div>
  )
}

export function MatchContactInfo({ match }: Props) {
  const emails = toStringArray(match.emails)
  const phones = toStringArray(match.phones)
  const websites = toStringArray(match.websites)
  const addresses = toStringArray(match.addresses)
  const total = emails.length + phones.length + websites.length + addresses.length
  if (total === 0) return null

  return (
    <section className="border-t pt-md space-y-sm" style={{ borderColor: 'var(--dash-border)' }}>
      <h4 className="sf-caption font-semibold uppercase tracking-wider"
        style={{ color: 'var(--dash-text-secondary)' }}>
        Contact & Addresses
      </h4>
      <div className="space-y-sm">
        {emails.length > 0 && <FieldGroup label="Email" values={emails} />}
        {phones.length > 0 && <FieldGroup label="Phone" values={phones} />}
        {websites.length > 0 && (
          <div>
            <span className="sf-caption" style={{ color: 'var(--dash-text-tertiary)' }}>Websites</span>
            {websites.map((w, i) => (
              <a key={i} href={w} target="_blank" rel="noopener noreferrer"
                className="sf-caption block mt-0.5 truncate hover:underline"
                style={{ color: 'var(--dash-accent)' }}>{w}</a>
            ))}
          </div>
        )}
        {addresses.length > 0 && <FieldGroup label="Address" values={addresses} />}
      </div>
    </section>
  )
}
