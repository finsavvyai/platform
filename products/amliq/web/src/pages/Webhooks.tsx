import { useState, useEffect, useCallback } from 'react'
import { ArrowUp } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { EmptyState } from '../components/ui/EmptyState'
import { api } from '../api/client'
import { WebhookForm } from '../components/webhooks/WebhookForm'
import { IncomingWebhookCard } from '../components/webhooks/IncomingWebhookCard'

interface Webhook {
  id: string; url: string; events: string[]; active: boolean; created_at: string;
}

export function Webhooks() {
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ subscriptions: Webhook[] }>('/webhooks/subscriptions')
      setHooks(d?.subscriptions ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const remove = async (id: string) => {
    if (!confirm('Delete this webhook?')) return
    try { await api.del(`/webhooks/subscriptions/${id}`); load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed') }
  }

  const test = async () => {
    try { await api.post('/webhooks/test', {}); alert('Test webhook sent!') }
    catch (err) { setError(err instanceof Error ? err.message : 'Test failed') }
  }

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Two-way integration with your systems. Incoming webhooks let your CRM / KYC / core banking push customers and transactions to AMLIQ for monitoring. Outgoing webhooks let AMLIQ notify your systems when a match, alert, or list update occurs."
      />

      <IncomingWebhookCard />

      <Card className="mb-lg">
        <div className="flex items-start gap-md mb-md">
          <div className="flex items-center justify-center w-9 h-9 rounded-apple-md shrink-0"
            style={{ background: 'rgba(201,169,110,0.1)' }}>
            <ArrowUp className="w-4.5 h-4.5" style={{ color: '#C9A96E' }} />
          </div>
          <div className="flex-1">
            <h3 className="sf-headline mb-xs">Outgoing — AMLIQ → your system</h3>
            <p className="sf-caption">
              Subscribe your endpoints to screening matches, monitoring alerts, and sanctions-list
              updates. Every delivery is signed with HMAC-SHA256 and retried with exponential backoff.
            </p>
          </div>
        </div>
        <div className="flex gap-sm">
          <Button variant="secondary" onClick={test}>Send test event</Button>
          <Button onClick={() => setShowForm(true)}>Add subscription</Button>
        </div>
      </Card>

      {showForm && <WebhookForm onSave={() => { setShowForm(false); load() }}
        onCancel={() => setShowForm(false)} setError={setError} />}
      {error && <Card className="mb-lg"><p role="alert" className="text-apple-red sf-body">{error}</p></Card>}
      {loading && <LoadingSpinner />}
      {!loading && hooks.length === 0 && !showForm && <EmptyState title="No outgoing subscriptions configured" />}
      {!loading && hooks.length > 0 && (
        <Card>
          {hooks.map(h => (
            <div key={h.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-lg py-md border-b last:border-0 gap-sm"
              style={{ borderColor: 'var(--dash-border)' }}>
              <div className="min-w-0 flex-1">
                <code className="text-sm break-all block" style={{ color: 'var(--dash-text)' }}>{h.url}</code>
                <div className="flex gap-xs mt-xs flex-wrap">
                  {(h.events ?? []).map(e => <Badge key={e} size="sm" color="purple">{e}</Badge>)}
                </div>
              </div>
              <button onClick={() => remove(h.id)}
                className="text-apple-red/60 hover:text-apple-red text-sm cursor-pointer self-end sm:self-center shrink-0">
                Delete
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

export default Webhooks
