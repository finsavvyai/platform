import { Hash, Diff, AudioLines, SplitSquareHorizontal, Sparkles, Network } from 'lucide-react'

const layers = [
  { icon: Hash, name: 'Exact', desc: 'Direct name and alias matching against all known identifiers.' },
  { icon: Diff, name: 'Fuzzy', desc: 'Edit-distance algorithms catch misspellings and transliteration variants.' },
  { icon: AudioLines, name: 'Phonetic', desc: 'Soundex and metaphone matching for names that sound alike across languages.' },
  { icon: SplitSquareHorizontal, name: 'Token', desc: 'Token-set comparison handles reordered names and partial matches.' },
  { icon: Sparkles, name: 'Semantic', desc: 'Vector embeddings capture meaning-level similarity across scripts.' },
  { icon: Network, name: 'Network', desc: 'Graph analysis identifies connections through known associates and entities.' },
]

export default function EngineSection() {
  return (
    <section id="engine" className="py-20 sm:py-28 px-4 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <p className="text-xs font-semibold tracking-widest uppercase text-token-gold text-center mb-4">
          MATCHING METHODOLOGY
        </p>
        <h2 className="text-3xl sm:text-4xl font-semibold text-slate-900 text-center mb-4">
          Six independent matching layers
        </h2>
        <p className="text-slate-600 text-center mb-14 max-w-2xl mx-auto">
          Deterministic layers handle exact and approximate matching.
          Uncertain results are escalated for review. Every result includes
          score, source, and explanation.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {layers.map(l => (
            <div key={l.name} className="bg-white border border-slate-200 rounded-xl p-6">
              <l.icon size={20} className="text-token-gold mb-3" />
              <h3 className="text-base font-semibold text-slate-900 mb-2">{l.name}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{l.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
