import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { api } from '../api/client'
import { MFAVerified } from '../components/auth/MFAVerified'
import { MFAStart } from '../components/auth/MFAStart'
import { MFASteps } from '../components/auth/MFASteps'

interface SetupData {
  qr_url: string; secret: string; recovery_codes: string[];
}

export function MFASetup() {
  const [setup, setSetup] = useState<SetupData | null>(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')

  const startSetup = async () => {
    setLoading(true); setError('')
    try { setSetup(await api.post<SetupData>('/auth/mfa/setup', {})) }
    catch (err) { setError(err instanceof Error ? err.message : 'Setup failed') }
    finally { setLoading(false) }
  }

  const verify = async () => {
    if (code.length !== 6) return
    setLoading(true); setError('')
    try { await api.post('/auth/mfa/verify', { code }); setVerified(true) }
    catch (err) { setError(err instanceof Error ? err.message : 'Invalid code') }
    finally { setLoading(false) }
  }

  if (verified) return <MFAVerified />

  return (
    <div className="max-w-lg mx-auto">
      <PageHeader title="Two-Factor Authentication"
        description="Add an extra layer of security to your account" />
      {!setup ? (
        <MFAStart onStart={startSetup} loading={loading} />
      ) : (
        <MFASteps setup={setup} code={code} onCodeChange={setCode}
          onVerify={verify} loading={loading} />
      )}
      {error && <Card className="mt-lg"><p role="alert" className="text-apple-red sf-body">{error}</p></Card>}
    </div>
  )
}

export default MFASetup
