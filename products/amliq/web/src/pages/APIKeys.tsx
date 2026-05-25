import { useState, useEffect, useCallback } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { api } from '../api/client'
import { NewKeyBanner } from '../components/apikeys/NewKeyBanner'
import { KeyRow } from '../components/apikeys/KeyRow'

interface APIKey {
  id: string; product: string; prefix: string;
  rate_limit: number; created_at: string; revoked: boolean;
}

export function APIKeys() {
  const [keys, setKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newKey, setNewKey] = useState('')
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ keys: APIKey[] }>('/keys')
      setKeys(d?.keys ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load keys')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setGenerating(true); setNewKey(''); setError('')
    try {
      const d = await api.post<{ key: string }>('/keys', { product: 'api' })
      setNewKey(d.key); load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed')
    } finally { setGenerating(false) }
  }

  const revoke = async (id: string) => {
    if (!confirm('Revoke this key? This cannot be undone.')) return
    try { await api.del(`/keys/${id}`); load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Revoke failed') }
  }

  return (
    <div>
      <PageHeader title="API Keys" description="Generate and manage API keys for your integrations" />
      <Card className="mb-lg">
        <div className="flex items-center justify-between">
          <p className="sf-body" style={{ color: 'var(--dash-text-secondary)' }}>Generate a new API key for your application</p>
          <Button onClick={generate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Key'}
          </Button>
        </div>
        {newKey && <NewKeyBanner keyValue={newKey} />}
      </Card>
      {error && <Card className="mb-lg"><p role="alert" className="text-apple-red sf-body">{error}</p></Card>}
      {loading && <LoadingSpinner />}
      {!loading && keys.length === 0 && <EmptyState title="No API keys yet" />}
      {!loading && keys.length > 0 && (
        <Card>{keys.map(k => <KeyRow key={k.id} apiKey={k} onRevoke={revoke} />)}</Card>
      )}
    </div>
  )
}

export default APIKeys
