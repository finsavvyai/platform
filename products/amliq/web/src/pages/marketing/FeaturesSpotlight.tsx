import { SlideIn, FadeIn } from './animations'

const features = [
  { label: 'SCREENING', title: 'Real-Time Sanctions Screening',
    desc: 'Screen any entity against 1M+ records from 26+ lists. Every match fully explained.',
    code: 'POST /api/v1/screen\n{ "entity_name": "Hassan Ali" }\n\n-> 200 OK (42ms)\n{ "total_matches": 4,\n  "confidence": 0.94 }',
  },
  { label: 'DISAMBIGUATION', title: 'Secondary Review for Ambiguous Matches',
    desc: 'Uncertain matches are escalated for automated review. Reduces false positives significantly.',
    code: 'Score: 0.62 (uncertain)\n-> Review: "Common Arabic name\n  pattern. Hassan = family."\n-> Confidence -> 0.85',
  },
  { label: 'CRYPTO', title: 'Wallet Screening',
    desc: 'Screen ETH/BTC/TRX wallets against 13,674 sanctioned addresses.',
    code: 'POST /api/v1/crypto/screen\n{ "wallet": "0x7d84...ab4e" }\n\n-> { "decision": "BLOCKED",\n    "list": "FBI Lazarus" }',
  },
  { label: 'FREETEXT', title: 'Document Screening',
    desc: 'Paste any document. Names are extracted and screened automatically.',
    code: 'POST /api/v1/screen/freetext\n{ "text": "Wire to Sberbank\n  for HAMAS..." }\n\n-> HAMAS: HIGH (94%)\n  Sberbank: HIGH (94%)',
  },
]

export default function FeaturesSpotlight() {
  return (
    <section className="py-20 sm:py-28 px-4">
      <div className="max-w-[980px] mx-auto">
        <FadeIn>
          <p className="text-sm font-semibold tracking-widest uppercase text-token-gold text-center mb-4">USE CASES</p>
          <h2 className="text-32 sm:text-48 font-bold text-center mb-20 text-slate-900">
            Built for real-world compliance.
          </h2>
        </FadeIn>
        {features.map((f, i) => {
          const rev = i % 2 === 1
          return (
            <div key={f.title} className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center mb-24 last:mb-0">
              <SlideIn from={rev ? 'right' : 'left'}>
                <div className={rev ? 'md:order-2' : ''}>
                  <p className="text-sm font-semibold tracking-widest uppercase text-token-gold mb-3">{f.label}</p>
                  <h3 className="text-28 font-semibold mb-3 text-slate-900">{f.title}</h3>
                  <p className="text-17 text-slate-600">{f.desc}</p>
                </div>
              </SlideIn>
              <SlideIn from={rev ? 'left' : 'right'} delay={0.15}>
                <pre className={`bg-slate-50 border border-slate-200 rounded-2xl p-6 text-13 leading-relaxed font-mono overflow-x-auto text-slate-600 ${rev ? 'md:order-1' : ''}`}>
                  {f.code}
                </pre>
              </SlideIn>
            </div>
          )
        })}
      </div>
    </section>
  )
}
