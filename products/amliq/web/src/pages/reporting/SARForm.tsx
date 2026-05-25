import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, CheckCircle } from 'lucide-react'
import { api } from '../../api/client'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

const ACTIVITY_TYPES = [
  { value: 'structuring', label: 'Structuring' },
  { value: 'money_laundering', label: 'Money Laundering' },
  { value: 'terrorist_financing', label: 'Terrorist Financing' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'identity_theft', label: 'Identity Theft' },
]

const REGULATORS = ['FinCEN', 'FCA', 'MAS', 'AUSTRAC', 'FINTRAC']

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  review: 'bg-[#C9A96E]/20 text-[#C9A96E]',
  filed: 'bg-apple-green/20 text-apple-green',
  acknowledged: 'bg-indigo-600/20 text-indigo-600',
}

export function SARForm() {
  const navigate = useNavigate()
  const [caseId, setCaseId] = useState('')
  const [subject, setSubject] = useState('')
  const [subjectType, setSubjectType] = useState('individual')
  const [activity, setActivity] = useState('structuring')
  const [regulator, setRegulator] = useState('FinCEN')
  const [narrative, setNarrative] = useState('')
  const [status, setStatus] = useState('draft')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filed, setFiled] = useState<{ id: string } | null>(null)

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ sar: { id: string; filing_status: string; narrative?: string } }>(
        '/reports/sar',
        { case_id: caseId, subject_name: subject, subject_type: subjectType, activity_type: activity, regulator },
      )
      setStatus(res?.sar?.filing_status ?? 'draft')
      if (res?.sar?.narrative) setNarrative(res.sar.narrative)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleFile = async () => {
    if (!narrative.trim()) { setError('Add a narrative before filing.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ sar: { id: string; filing_status: string } }>(
        '/reports/sar/file',
        { case_id: caseId, subject_name: subject, subject_type: subjectType, activity_type: activity, regulator, narrative },
      )
      setFiled({ id: res?.sar?.id ?? '' })
      setStatus('filed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Filing failed')
    } finally {
      setLoading(false)
    }
  }

  if (filed) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <div className="flex items-start gap-md">
            <CheckCircle className="w-6 h-6 shrink-0 mt-0.5" style={{ color: '#34C759' }} />
            <div>
              <p className="font-semibold mb-xs" style={{ color: 'var(--dash-text)' }}>
                SAR filed successfully
              </p>
              <p className="text-sm mb-md" style={{ color: 'var(--dash-text-secondary)' }}>
                Reference ID: <code>{filed.id}</code>. The regulator will acknowledge within 30 days.
              </p>
              <Button variant="secondary" size="sm" onClick={() => navigate('/audit')}>
                View audit trail
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={() => navigate(-1)}
        className="inline-flex items-center gap-xs text-sm mb-md opacity-70 hover:opacity-100 cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <PageHeader
        title="Suspicious Activity Report"
        description="Generate and file a SAR with your regulator directly from the case. AI drafts the narrative — you review and file."
      />

      <Card className="mb-md">
        <div className="flex items-center gap-sm mb-md">
          <FileText className="w-4 h-4" style={{ color: 'var(--dash-text-secondary)' }} />
          <span className="text-sm" style={{ color: 'var(--dash-text-secondary)' }}>Filing status:</span>
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[status] ?? ''}`}>
            {status.toUpperCase()}
          </span>
        </div>

        <form onSubmit={handleGenerate} className="space-y-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
            <label className="block">
              <span className="text-sm block mb-xs" style={{ color: 'var(--dash-text-secondary)' }}>Case ID</span>
              <input className="input-field w-full" value={caseId}
                onChange={e => setCaseId(e.target.value)} required placeholder="case-001" />
            </label>
            <label className="block">
              <span className="text-sm block mb-xs" style={{ color: 'var(--dash-text-secondary)' }}>Subject Name</span>
              <input className="input-field w-full" value={subject}
                onChange={e => setSubject(e.target.value)} required placeholder="John Doe" />
            </label>
            <label className="block">
              <span className="text-sm block mb-xs" style={{ color: 'var(--dash-text-secondary)' }}>Subject Type</span>
              <select className="input-field w-full" value={subjectType} onChange={e => setSubjectType(e.target.value)}>
                <option value="individual">Individual</option>
                <option value="entity">Entity</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm block mb-xs" style={{ color: 'var(--dash-text-secondary)' }}>Activity Type</span>
              <select className="input-field w-full" value={activity} onChange={e => setActivity(e.target.value)}>
                {ACTIVITY_TYPES.map(at => <option key={at.value} value={at.value}>{at.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm block mb-xs" style={{ color: 'var(--dash-text-secondary)' }}>Regulatory Body</span>
              <select className="input-field w-full" value={regulator} onChange={e => setRegulator(e.target.value)}>
                {REGULATORS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm block mb-xs" style={{ color: 'var(--dash-text-secondary)' }}>Narrative</span>
            <textarea className="input-field w-full h-32" value={narrative}
              onChange={e => setNarrative(e.target.value)}
              placeholder="AI-generated narrative will appear here. Review and edit before filing." />
          </label>

          {error && <p role="alert" className="text-sm" style={{ color: '#C0392B' }}>{error}</p>}

          <div className="flex flex-col sm:flex-row gap-sm pt-sm">
            <Button type="submit" disabled={loading}>
              {loading ? 'Generating…' : 'Generate SAR'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStatus('review')}>
              Submit for Review
            </Button>
            {status !== 'draft' && (
              <Button type="button" variant="secondary" onClick={handleFile} disabled={loading}>
                {loading ? 'Filing…' : `File with ${regulator}`}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  )
}
