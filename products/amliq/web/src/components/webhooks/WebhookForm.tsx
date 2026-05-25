import { useState } from 'react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { api } from '../../api/client'

const EVENT_TYPES = [
  'screening.completed', 'screening.match_found',
  'alert.created', 'alert.resolved',
  'case.created', 'case.escalated',
  'list.updated', 'entity.added', 'entity.removed',
]

interface Props {
  onSave: () => void; onCancel: () => void; setError: (e: string) => void
}

export function WebhookForm({ onSave, onCancel, setError }: Props) {
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['screening.match_found'])
  const [saving, setSaving] = useState(false)

  const toggle = (evt: string) =>
    setEvents(events.includes(evt) ? events.filter(e => e !== evt) : [...events, evt])

  const save = async () => {
    if (!url.trim()) return
    setSaving(true)
    try { await api.post('/webhooks/subscribe', { url, events }); onSave() }
    catch (err) { setError(err instanceof Error ? err.message : 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <Card className="mb-lg">
      <input value={url} onChange={e => setUrl(e.target.value)}
        placeholder="https://your-server.com/webhook" className="input-field w-full mb-md" />
      <p className="sf-caption mb-sm" style={{ color: 'var(--dash-text-secondary)' }}>Events:</p>
      <div className="flex flex-wrap gap-sm mb-lg">
        {EVENT_TYPES.map(evt => (
          <button key={evt} onClick={() => toggle(evt)}
            className={`px-md py-xs rounded-full text-xs cursor-pointer transition-colors min-h-[44px] ${
              events.includes(evt) ? 'bg-[#1A1814] text-[#C9A96E]' : 'bg-white/[0.04]'}`}
            style={events.includes(evt) ? undefined : { color: 'var(--dash-text-secondary)' }}>
            {evt}
          </button>
        ))}
      </div>
      <div className="flex gap-sm">
        <Button onClick={save} disabled={saving || !url.trim()}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  )
}
