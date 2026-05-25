const faqs = [
  { q: 'What is AMLIQ?',
    a: 'AMLIQ is a sanctions screening infrastructure platform for financial institutions. It screens entities against 86+ global sanctions and watchlists with sub-millisecond latency using a multi-layer matching engine.' },
  { q: 'How does AMLIQ reduce false positives?',
    a: 'AMLIQ runs a multi-layer matching cascade — exact, fuzzy, phonetic, and token in production, with semantic and graph layers in active rollout — combined with a disambiguation step for uncertain results. Reproducible benchmarks against other screening tools are published at /benchmarks rather than relying on aggregate marketing claims.' },
  { q: 'What sanctions lists does AMLIQ screen against?',
    a: 'OFAC SDN, UN Consolidated, EU Financial Sanctions, UK OFSI, FATF, PEP databases, and 80+ additional lists covering 3M+ sanctioned entities updated daily.' },
  { q: 'How fast is AMLIQ screening?',
    a: 'Sub-millisecond single-entity screening with batch API support for bulk portfolios. In-memory engine with zero cold starts.' },
  { q: 'Does AMLIQ have an API?',
    a: 'Yes. Full REST API with endpoints for single screening, batch screening, crypto wallet screening, and alert management.' },
]

function buildSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

export default function FAQSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(buildSchema()) }}
    />
  )
}
