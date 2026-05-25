import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { StepIndicator } from './onboarding/StepIndicator'
import { CountryStep } from './onboarding/CountryStep'
import { ListsStep } from './onboarding/ListsStep'
import { ThresholdStep } from './onboarding/ThresholdStep'

const COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'IL', label: 'Israel' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'DE', label: 'Germany' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'JP', label: 'Japan' },
]

interface ListSuggestion {
  list_id: string; threshold: number; sync_enabled: boolean
}

export default function Onboarding() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [country, setCountry] = useState('')
  const [lists, setLists] = useState<ListSuggestion[]>([])
  const [threshold, setThreshold] = useState(70)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (country) {
      api.get<{ lists: ListSuggestion[] }>(`/onboarding/lists?country=${country}`)
        .then(r => setLists(r.lists ?? []))
    }
  }, [country])

  const handleFinish = async () => {
    setSaving(true)
    try {
      await api.put('/config', { default_threshold: threshold / 100 })
      navigate('/dashboard')
    } catch { setSaving(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-lg" style={{ background: 'var(--dash-bg)' }}>
      <div className="max-w-lg w-full space-y-xl">
        <h1 className="sf-title text-center" style={{ color: 'var(--dash-text)' }}>{t('welcome')}</h1>
        <StepIndicator current={step} />
        {step === 1 && <CountryStep countries={COUNTRIES} value={country}
          onChange={c => { setCountry(c); setStep(2) }} />}
        {step === 2 && <ListsStep lists={lists} onNext={() => setStep(3)} />}
        {step === 3 && <ThresholdStep value={threshold}
          onChange={setThreshold} onFinish={handleFinish} saving={saving} />}
      </div>
    </div>
  )
}
