import { useState, useEffect } from 'react'
import { Copy, Check, ArrowDown, RefreshCw, Eye, EyeOff, Lock } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { api } from '../../api/client'

const INGEST_BASE = 'https://api.amliq.finance/api/v1/ingest'

const ENDPOINTS = [
  {
    event: 'customer.created',
    url: `${INGEST_BASE}/customers`,
    desc: 'Onboard a new customer into ongoing monitoring.',
    sample: {
      external_id: 'cust_abc123',
      entity_type: 'individual',
      first_name: 'Jane',
      last_name: 'Doe',
      date_of_birth: '1985-04-12',
      nationality: 'US',
      country_of_residence: 'US',
    },
  },
  {
    event: 'customer.updated',
    url: `${INGEST_BASE}/customers`,
    desc: 'Update an existing customer (address change, new identifier).',
    sample: { external_id: 'cust_abc123', nationality: 'GB' },
  },
  {
    event: 'transaction.created',
    url: `${INGEST_BASE}/transactions`,
    desc: 'Stream a transaction for real-time AML rules + counterparty screening.',
    sample: {
      external_id: 'txn_xyz789',
      customer_external_id: 'cust_abc123',
      amount: 12500.00,
      currency: 'USD',
      counterparty_name: 'Acme Trading LLC',
      counterparty_country: 'AE',
      timestamp: '2026-04-14T12:34:56Z',
    },
  },
]

export function IncomingWebhookCard() {
  const [copied, setCopied] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [showSecret, setShowSecret] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [secretState, setSecretState] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading')
  const [secretError, setSecretError] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ signing_secret: string }>('/webhooks/incoming/secret')
      .then(d => {
        const s = d?.signing_secret ?? null
        setSecret(s)
        setSecretState(s ? 'ready' : 'empty')
      })
      .catch(err => {
        setSecret(null)
        setSecretError(err?.message || 'Failed to load signing secret')
        setSecretState('error')
      })
  }, [])

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const rotate = async () => {
    if (!confirm('Rotating will invalidate the current secret. Your integration will reject requests until you update the secret on your side. Continue?')) return
    setRotating(true)
    setSecretError(null)
    try {
      const d = await api.post<{ signing_secret: string }>('/webhooks/incoming/secret/rotate', {})
      const s = d?.signing_secret ?? null
      setSecret(s)
      setSecretState(s ? 'ready' : 'empty')
      setShowSecret(true)
    } catch (err: any) {
      setSecretError(err?.message || 'Rotation failed')
      setSecretState('error')
    } finally { setRotating(false) }
  }

  const masked = secret ? secret.slice(0, 8) + '•'.repeat(24) : ''

  const secretDisplay = secretState === 'ready'
    ? (showSecret ? secret : masked)
    : secretState === 'loading' ? 'Loading…'
      : secretState === 'empty' ? 'No secret yet — click Rotate to generate one'
        : (secretError || 'Failed to load secret')

  return (
    <Card className="mb-lg">
      <div className="flex items-start gap-md mb-md">
        <div className="flex items-center justify-center w-9 h-9 rounded-apple-md shrink-0"
          style={{ background: 'rgba(201,169,110,0.1)' }}>
          <ArrowDown className="w-4.5 h-4.5" style={{ color: '#C9A96E' }} />
        </div>
        <div>
          <h3 className="sf-headline mb-xs">Incoming — your system → AMLIQ</h3>
          <p className="sf-caption">
            Point your CRM, KYC provider, or core banking system at these endpoints. Each
            event is authenticated with your API key and verified using an HMAC signature
            (<code className="text-xs px-1 rounded" style={{ background: 'var(--dash-surface)' }}>X-AMLIQ-Signature</code> header).
            New customers and transactions are onboarded automatically.
          </p>
        </div>
      </div>
      <div className="space-y-sm">
        {ENDPOINTS.map(e => (
          <div key={e.event} className="rounded-apple-md border p-md"
            style={{ borderColor: 'var(--dash-border)' }}>
            <div className="flex items-center justify-between mb-xs gap-sm flex-wrap">
              <code className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ background: 'rgba(201,169,110,0.12)', color: '#C9A96E' }}>
                {e.event}
              </code>
              <button onClick={() => copy(e.url, e.event)}
                className="flex items-center gap-xs text-xs cursor-pointer hover:opacity-80"
                style={{ color: 'var(--dash-text-secondary)' }}>
                {copied === e.event ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied === e.event ? 'Copied' : 'Copy URL'}
              </button>
            </div>
            <p className="text-xs mb-xs" style={{ color: 'var(--dash-text-secondary)' }}>{e.desc}</p>
            <code className="text-xs break-all block mb-xs" style={{ color: 'var(--dash-text)' }}>
              POST {e.url}
            </code>
            <details>
              <summary className="text-xs cursor-pointer" style={{ color: 'var(--dash-text-tertiary)' }}>
                Sample payload
              </summary>
              <pre className="text-xs mt-xs p-sm rounded overflow-x-auto"
                style={{ background: 'var(--dash-surface)', color: 'var(--dash-text)' }}>
{JSON.stringify(e.sample, null, 2)}
              </pre>
            </details>
          </div>
        ))}
      </div>
      <div className="mt-md rounded-apple-md border p-md"
        style={{ borderColor: 'var(--dash-border)', background: 'var(--dash-surface)' }}>
        <div className="flex items-center gap-sm mb-sm">
          <Lock className="w-4 h-4" style={{ color: '#C9A96E' }} />
          <h4 className="text-sm font-semibold" style={{ color: 'var(--dash-text)' }}>
            Signing secret (HMAC-SHA256)
          </h4>
        </div>
        <p className="text-xs mb-sm" style={{ color: 'var(--dash-text-secondary)' }}>
          Every incoming request must include a valid <code>X-AMLIQ-Signature</code> header.
          We reject any payload whose computed HMAC doesn’t match. Your API key handles
          auth; this secret proves the payload wasn’t tampered with in transit.
        </p>
        <div className="flex items-center gap-sm flex-wrap">
          <code className="text-xs font-mono px-sm py-xs rounded flex-1 min-w-[240px] overflow-x-auto"
            style={{
              background: 'var(--dash-bg-secondary)',
              color: secretState === 'error' ? 'var(--apple-red, #ef4444)' : 'var(--dash-text)',
            }}>
            {secretDisplay}
          </code>
          <button onClick={() => setShowSecret(s => !s)}
            aria-label={showSecret ? 'Hide secret' : 'Reveal secret'}
            className="cursor-pointer opacity-70 hover:opacity-100 shrink-0">
            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          {secret && (
            <button onClick={() => copy(secret, 'secret')}
              className="flex items-center gap-xs text-xs cursor-pointer hover:opacity-80 shrink-0"
              style={{ color: 'var(--dash-text-secondary)' }}>
              {copied === 'secret' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === 'secret' ? 'Copied' : 'Copy'}
            </button>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={rotate} disabled={rotating}
          className="mt-sm inline-flex items-center gap-xs">
          <RefreshCw className="w-3 h-3" /> {rotating ? 'Rotating…' : 'Rotate secret'}
        </Button>
      </div>
      <div className="mt-md flex gap-sm">
        <Button variant="secondary" size="sm" onClick={() => window.location.assign('/keys')}>
          Manage API keys
        </Button>
      </div>
    </Card>
  )
}
