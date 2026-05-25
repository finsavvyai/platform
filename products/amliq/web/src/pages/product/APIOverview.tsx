const request = `POST /v1/screen
{
  "entity_name": "Hassan Ali Mohammad",
  "lists": ["OFAC", "UN", "EU"]
}`

const response = `Response (0.8ms):
{
  "matches": [{
    "name": "HASSAN ALI",
    "list": "OFAC SDN",
    "score": 0.94,
    "explanation": "Exact + phonetic match"
  }]
}`

export default function APIOverview() {
  return (
    <section className="py-16 sm:py-24 px-4 bg-token-bg-2">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-token-fg mb-4">
          API Overview
        </h2>
        <p className="text-base text-token-fg-muted mb-10 max-w-2xl">
          A single endpoint handles real-time screening with sub-millisecond latency.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {[
            { label: 'Request', body: request },
            { label: 'Response', body: response },
          ].map(({ label, body }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wider text-token-fg-faint mb-3">
                {label}
              </p>
              <pre
                className="text-sm rounded-lg p-5 overflow-x-auto leading-relaxed force-ltr"
                style={{ background: '#0A0908', color: '#F0EDE7', border: '1px solid var(--separator)' }}
              >
                {body}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
