import type { LayerEvidence } from '../../types'

interface Props {
  layers: LayerEvidence[]
}

function gradientColor(pct: number): string {
  if (pct >= 80) return 'from-[#E05252] to-[#E0A83A]'
  if (pct >= 50) return 'from-[#E0A83A] to-[#C9A96E]'
  return 'from-[#3DAA6A] to-[#1B6B72]'
}

function prettify(raw: string): string {
  if (!raw) return ''
  return raw
    .split('+')
    .map(part => part.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
    .join(' + ')
}

function EvidenceBar({ layer }: { layer: LayerEvidence }) {
  const pct = Math.round(layer.score * 100)

  return (
    <div>
      <div className="flex items-center justify-between mb-xs">
        <span className="sf-caption font-semibold" style={{ color: 'var(--dash-text)' }}>
          {prettify(layer.layer)}
        </span>
        <span className="sf-caption" style={{ color: 'var(--dash-text-secondary)' }}>
          {prettify(layer.algorithm)} — {pct}%
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--separator)' }}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${gradientColor(pct)} transition-all duration-500`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${layer.layer} score`}
        />
      </div>
      {layer.matched && (
        <p className="sf-caption mt-xs truncate" style={{ color: 'var(--dash-text-tertiary)' }}>
          Matched: &ldquo;{layer.matched}&rdquo;
        </p>
      )}
    </div>
  )
}

function dedupe(layers: LayerEvidence[]): LayerEvidence[] {
  const seen = new Set<string>()
  const out: LayerEvidence[] = []
  for (const l of layers) {
    const key = `${l.layer}|${l.algorithm}|${l.score}|${l.matched ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(l)
  }
  return out
}

export function MatchEvidenceBars({ layers }: Props) {
  if (!layers || layers.length === 0) return null
  const unique = dedupe(layers)

  return (
    <section className="border-t pt-md space-y-md" style={{ borderColor: 'var(--dash-border)' }}>
      <h4 className="sf-caption font-semibold uppercase tracking-wider" style={{ color: 'var(--dash-text-secondary)' }}>
        Evidence Layers
      </h4>
      {unique.map((layer, i) => (
        <EvidenceBar key={`${layer.layer}-${layer.algorithm}-${i}`} layer={layer} />
      ))}
    </section>
  )
}
