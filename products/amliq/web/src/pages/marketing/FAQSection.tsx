import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  { q: 'What is AMLIQ?',
    a: 'AMLIQ is a sanctions screening infrastructure platform for financial institutions. It screens entities against 86+ global sanctions and watchlists with sub-millisecond latency using a multi-layer matching engine.' },
  { q: 'How does AMLIQ reduce false positives?',
    a: 'AMLIQ runs four matching layers in production -- exact, fuzzy, phonetic, and token -- with semantic (vector embedding) and network (graph) layers in active rollout. The layers produce a weighted composite score, and uncertain results are escalated through a disambiguation cascade. Customers see materially fewer false positives than single-layer tools; we publish reproducible benchmarks rather than rely on aggregate marketing claims.' },
  { q: 'What sanctions lists are supported?',
    a: 'OFAC SDN, UN Consolidated, EU Financial Sanctions, UK OFSI, FATF, PEP databases, and 80+ additional lists covering 3M+ entities. Lists are updated daily from official government sources.' },
  { q: 'How fast is screening?',
    a: 'Sub-millisecond for single entities. The in-memory engine has zero cold starts. Batch API supports bulk portfolio screening.' },
  { q: 'Can AMLIQ be self-hosted?',
    a: 'Yes. Enterprise customers can deploy AMLIQ on-premise or in their own cloud environment for data residency and compliance requirements.' },
  { q: 'How does AMLIQ handle data privacy?',
    a: 'AMLIQ supports data residency controls, encrypted storage, and full audit logging. Enterprise plans include RBAC, compliance-grade retention policies, and SAML SSO (in development).' },
  { q: 'What does integration look like?',
    a: 'A single REST API endpoint. Most teams integrate in under an hour. SDKs available for Python, Node.js, Go, and Java.' },
]

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left cursor-pointer group min-h-[44px]">
        <span className="text-base font-semibold pr-4 text-slate-900">{q}</span>
        <ChevronDown size={18}
          className={`shrink-0 text-slate-600 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed pr-8 text-slate-600">{a}</p>
      )}
    </div>
  )
}

export default function FAQSection() {
  return (
    <section id="faq" className="py-20 sm:py-28 px-4 bg-white">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-semibold tracking-widest uppercase text-token-gold text-center mb-4">FAQ</p>
        <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 text-center mb-12">
          Common questions
        </h2>
        <div>{faqs.map(f => <Item key={f.q} q={f.q} a={f.a} />)}</div>
      </div>
    </section>
  )
}
