'use client'

/**
 * CMEK admin page. Lets a tenant admin enter or clear their KEK ARN.
 * GET /admin/tenants/{id}/cmek loads current state; PATCH writes.
 *
 * Validation mirrors the gateway's looksLikeKEK: AWS KMS ARN, GCP
 * KMS resource name, or Azure Key Vault URL. Anything else returns
 * 400 from the server; the client also pre-warns to save a round-trip.
 */

import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api-client'

type CMEKState = {
  tenant_id: string
  kms_key_arn: string | null
  enabled: boolean
}

const HINT_AWS = 'arn:aws:kms:us-east-1:111111111111:key/abcd-...'
const HINT_GCP = 'projects/<proj>/locations/<loc>/keyRings/<r>/cryptoKeys/<k>'
const HINT_AZURE = 'https://<vault>.vault.azure.net/keys/<key>'

function looksLikeKEK(s: string): boolean {
  const v = s.trim()
  if (v.startsWith('arn:aws:kms:')) return true
  if (v.startsWith('projects/') && v.includes('/cryptoKeys/')) return true
  if (v.startsWith('https://') && v.includes('.vault.azure.net/keys/')) return true
  return false
}

export default function EncryptionPage() {
  const [tenantId, setTenantId] = useState('')
  const [arn, setArn] = useState('')
  const [state, setState] = useState<CMEKState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function load(id: string) {
    setError(null)
    try {
      const res = await apiClient.get<CMEKState>(`/admin/tenants/${id}/cmek`)
      setState(res)
      setArn(res.kms_key_arn ?? '')
    } catch (e: any) {
      setError(e?.message ?? 'failed to load')
    }
  }

  useEffect(() => {
    if (tenantId) void load(tenantId)
  }, [tenantId])

  async function save() {
    setError(null)
    if (arn && !looksLikeKEK(arn)) {
      setError('Must be an AWS KMS ARN, GCP resource name, or Azure Key Vault URL')
      return
    }
    setSaving(true)
    try {
      const body = { kms_key_arn: arn === '' ? null : arn }
      const res = await apiClient.patch<CMEKState>(`/admin/tenants/${tenantId}/cmek`, body)
      setState(res)
    } catch (e: any) {
      setError(e?.message ?? 'failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold">Encryption (CMEK)</h1>
        <p className="text-sm text-muted-foreground">
          Bring your own key for documents-at-rest. Documents written after
          you save here are encrypted with a per-row data key wrapped by
          your KMS key. Revoking the IAM grant on the KEK makes future
          reads return 503 — the platform never holds the plaintext key.
        </p>
      </header>

      <section className="space-y-2">
        <label className="block text-sm font-medium">Tenant ID</label>
        <input
          className="w-full rounded-md border px-3 py-2"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="00000000-0000-0000-0000-000000000000"
        />
      </section>

      <section className="space-y-2">
        <label className="block text-sm font-medium">KEK identifier</label>
        <input
          className="w-full rounded-md border px-3 py-2 font-mono text-xs"
          value={arn}
          onChange={(e) => setArn(e.target.value)}
          placeholder={HINT_AWS}
        />
        <ul className="text-xs text-muted-foreground space-y-1">
          <li>AWS: <code className="font-mono">{HINT_AWS}</code></li>
          <li>GCP: <code className="font-mono">{HINT_GCP}</code></li>
          <li>Azure: <code className="font-mono">{HINT_AZURE}</code></li>
          <li>Leave blank to disable CMEK (platform-managed key resumes).</li>
        </ul>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between">
        <span className="text-sm">
          Current: {state?.enabled ? <span className="text-green-700">Enabled</span> : 'Platform-managed'}
        </span>
        <button
          type="button"
          className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          disabled={!tenantId || saving}
          onClick={save}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
