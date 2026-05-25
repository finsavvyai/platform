import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../api/client'
import { RiskResultCard } from '../components/compliance/RiskResultCard'
import { RISK_COUNTRIES } from '../data/riskCountries'

interface RiskResult {
  composite_score: number
  risk_level: string
  factors: string[]
  breakdown: Record<string, number>
}

const INDUSTRIES = [
  { value: '', label: 'Select industry (optional)' },
  { value: 'banking', label: 'Banking & Financial Services' },
  { value: 'fintech', label: 'Fintech / Payments' },
  { value: 'crypto', label: 'Crypto / Virtual Assets' },
  { value: 'gambling', label: 'Gambling / Gaming' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'import_export', label: 'Import / Export' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'retail', label: 'Retail' },
  { value: 'other', label: 'Other' },
]

export function RiskAssessment() {
  const { t } = useTranslation('compliance')
  const [form, setForm] = useState({
    entityId: '', entityType: 'individual', country: '', industry: '',
    isPep: false, hasSanctionsHit: false, hasAdverseMedia: false,
  })
  const [result, setResult] = useState<RiskResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const calculate = async () => {
    if (!form.entityId.trim() || form.entityId.trim().length < 2) {
      setError('Entity ID must be at least 2 characters.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const d = await api.post<RiskResult>('/risk/score', {
        entity_id: form.entityId,
        entity_type: form.entityType,
        country: form.country,
        industry: form.industry,
        sanctions_score: form.hasSanctionsHit ? 1 : 0,
        pep_score: form.isPep ? 1 : 0,
        adverse_media_score: form.hasAdverseMedia ? 0.7 : 0,
        industry_score: 0,
      })
      setResult(d ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const update = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title={t('risk.title')} description="Calculate composite risk scores from entity profile, jurisdiction, industry, and screening signals" />
      <Card className="mb-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-lg mb-lg">
          <div>
            <label className="text-xs font-medium mb-xs block" style={{ color: 'var(--dash-text-secondary)' }}>Entity ID / Name</label>
            <input placeholder="e.g. cust_abc123 or John Doe" value={form.entityId}
              aria-label="Entity identifier"
              onChange={e => update('entityId', e.target.value)} className="input-field w-full" />
          </div>
          <div>
            <label className="text-xs font-medium mb-xs block" style={{ color: 'var(--dash-text-secondary)' }}>Entity type</label>
            <select value={form.entityType} onChange={e => update('entityType', e.target.value)}
              className="input-field w-full" aria-label="Entity type">
              <option value="individual">Individual</option>
              <option value="company">Company</option>
              <option value="vessel">Vessel</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-xs block" style={{ color: 'var(--dash-text-secondary)' }}>Country of residence / incorporation</label>
            <select value={form.country} onChange={e => update('country', e.target.value)}
              className="input-field w-full" aria-label="Country">
              <option value="">Select country</option>
              {RISK_COUNTRIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.name}{c.risk === 'high' ? ' — FATF high-risk' : c.risk === 'medium' ? ' — enhanced DD' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-xs block" style={{ color: 'var(--dash-text-secondary)' }}>Industry</label>
            <select value={form.industry} onChange={e => update('industry', e.target.value)}
              className="input-field w-full" aria-label="Industry">
              {INDUSTRIES.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-sm mb-lg">
          <p className="text-xs font-medium" style={{ color: 'var(--dash-text-secondary)' }}>Screening signals</p>
          <label className="flex items-center gap-sm text-sm cursor-pointer">
            <input type="checkbox" checked={form.isPep}
              onChange={e => update('isPep', e.target.checked)}
              className="w-4 h-4 rounded accent-[#C9A96E]" />
            <span>Politically Exposed Person (PEP)</span>
          </label>
          <label className="flex items-center gap-sm text-sm cursor-pointer">
            <input type="checkbox" checked={form.hasSanctionsHit}
              onChange={e => update('hasSanctionsHit', e.target.checked)}
              className="w-4 h-4 rounded accent-[#C9A96E]" />
            <span>Sanctions list hit (OFAC / EU / UN / UK HMT)</span>
          </label>
          <label className="flex items-center gap-sm text-sm cursor-pointer">
            <input type="checkbox" checked={form.hasAdverseMedia}
              onChange={e => update('hasAdverseMedia', e.target.checked)}
              className="w-4 h-4 rounded accent-[#C9A96E]" />
            <span>Adverse media findings</span>
          </label>
        </div>

        <Button onClick={calculate} disabled={loading || !form.entityId.trim()} className="w-full">
          {loading ? 'Calculating...' : t('risk.calculate')}
        </Button>
      </Card>

      {loading && <LoadingSpinner />}
      {error && (
        <Card className="mb-lg">
          <p role="alert" className="text-red-500 sf-body">{error}</p>
        </Card>
      )}
      {result && <RiskResultCard result={result} t={t} />}
    </div>
  )
}
