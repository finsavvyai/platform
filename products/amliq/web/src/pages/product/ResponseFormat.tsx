import { CheckCircle } from 'lucide-react'

const fields = [
  { label: 'Confidence score', desc: 'Weighted aggregate from all matching layers (0.00 to 1.00).' },
  { label: 'Matched list', desc: 'Which sanctions list produced the hit (OFAC SDN, UN, EU, etc.).' },
  { label: 'Matched fields', desc: 'Specific fields that contributed to the match (name, alias, DOB).' },
  { label: 'Explanation text', desc: 'Human-readable summary of why this match was flagged.' },
  { label: 'Audit metadata', desc: 'Request ID, timestamp, engine version, and processing duration.' },
]

export default function ResponseFormat() {
  return (
    <section className="py-16 sm:py-24 px-4 bg-token-bg">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-token-fg mb-4">
          Response Format
        </h2>
        <p className="text-base text-token-fg-muted mb-10 max-w-2xl">
          Every screening result includes the data your compliance team needs.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {fields.map(f => (
            <div key={f.label} className="flex gap-3 p-4 border border-token-line rounded-lg bg-token-surface">
              <CheckCircle className="w-5 h-5 text-token-gold mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-token-fg">{f.label}</p>
                <p className="text-sm text-token-fg-muted mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
