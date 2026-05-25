const layers = [
  { name: 'Exact', what: 'Character-level string comparison after normalization.', when: 'Catches direct hits and known alias matches.', status: 'production' },
  { name: 'Fuzzy', what: 'Edit-distance and Jaro-Winkler similarity scoring.', when: 'Handles typos, transliteration variants, and partial names.', status: 'production' },
  { name: 'Phonetic', what: 'Soundex, Metaphone, and language-aware phonetic encoding.', when: 'Detects names that sound alike across languages.', status: 'production' },
  { name: 'Token', what: 'Bag-of-words token overlap and reordering detection.', when: 'Catches swapped name components (first/last inversion).', status: 'production' },
  { name: 'Semantic', what: 'Vector embedding similarity using domain-trained models.', when: 'Surfaces contextual matches that rules would miss.', status: 'rollout' },
  { name: 'Network', what: 'Graph traversal across known entity relationships.', when: 'Identifies indirect associations and shell companies.', status: 'rollout' },
]

export default function MatchingEngine() {
  return (
    <section className="py-16 sm:py-24 px-4 bg-token-bg">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-token-fg mb-4">
          Multi-Layer Matching Engine
        </h2>
        <p className="text-base text-token-fg-muted mb-10 max-w-2xl">
          Four layers in production today; semantic and network layers in active rollout.
          Each layer adds coverage. Together, they eliminate blind spots.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {layers.map(l => (
            <div key={l.name} className="border border-token-line rounded-lg p-6 bg-token-surface">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold text-token-fg">{l.name}</h3>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${l.status === 'production' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {l.status === 'production' ? 'Live' : 'Rollout'}
                </span>
              </div>
              <p className="text-sm text-token-fg-muted mb-3">{l.what}</p>
              <p className="text-xs text-token-fg-faint">{l.when}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-token-fg-faint max-w-3xl">
          Deterministic layers handle exact and approximate matching. Uncertain
          results are escalated for controlled secondary review.
        </p>
      </div>
    </section>
  )
}
