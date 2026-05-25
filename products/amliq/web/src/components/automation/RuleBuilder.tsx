import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { api } from '../../api/client'

export type ActionType = 'email' | 'sms' | 'webhook' | 'open_case'

export interface RuleAction {
  type: ActionType
  target: string
}

export interface AutomationRule {
  id: string
  name: string
  trigger: string
  condition?: string
  actions: RuleAction[]
  enabled: boolean
}

const TRIGGERS = [
  { v: 'customer.created', l: 'Customer created (incoming webhook)' },
  { v: 'customer.updated', l: 'Customer updated (incoming webhook)' },
  { v: 'transaction.created', l: 'Transaction created (incoming webhook)' },
  { v: 'match.found', l: 'Screening match found' },
  { v: 'alert.opened', l: 'Alert opened' },
  { v: 'alert.escalated', l: 'Alert escalated' },
  { v: 'list.updated', l: 'Sanctions list updated' },
]

const CONDITION_PRESETS = [
  { v: '', l: 'Always (no condition)' },
  { v: 'severity >= high', l: 'Severity is high or critical' },
  { v: 'country in fatf_high_risk', l: 'Country is FATF high-risk' },
  { v: 'amount > 10000', l: 'Transaction amount > $10,000' },
  { v: 'pep = true', l: 'Entity is a PEP' },
  { v: 'sanctions_hit = true', l: 'Sanctions list hit' },
]

const ACTION_TYPES: { v: ActionType; l: string; placeholder: string }[] = [
  { v: 'email', l: 'Send email', placeholder: 'analyst@example.com' },
  { v: 'sms', l: 'Send SMS', placeholder: '+1-555-123-4567' },
  { v: 'webhook', l: 'POST to webhook', placeholder: 'https://your-system.com/amliq-events' },
  { v: 'open_case', l: 'Open investigation case', placeholder: 'Assignee email (optional)' },
]

interface Props {
  onSave: () => void
  onCancel: () => void
}

export function RuleBuilder({ onSave, onCancel }: Props) {
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState(TRIGGERS[0].v)
  const [condition, setCondition] = useState('')
  const [actions, setActions] = useState<RuleAction[]>([{ type: 'email', target: '' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addAction = () => setActions(a => [...a, { type: 'email', target: '' }])
  const removeAction = (i: number) => setActions(a => a.filter((_, idx) => idx !== i))
  const updateAction = (i: number, patch: Partial<RuleAction>) =>
    setActions(a => a.map((x, idx) => idx === i ? { ...x, ...patch } : x))

  const save = async () => {
    setError('')
    if (!name.trim()) return setError('Give the rule a name.')
    if (actions.some(a => !a.target.trim())) return setError('Every action needs a target.')
    setSaving(true)
    try {
      await api.post('/automation/rules', { name, trigger, condition, actions, enabled: true })
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally { setSaving(false) }
  }

  const actionPlaceholder = (t: ActionType) =>
    ACTION_TYPES.find(x => x.v === t)?.placeholder ?? ''

  return (
    <Card className="mb-lg">
      <div className="flex items-center justify-between mb-md">
        <h3 className="sf-headline">New automation rule</h3>
        <button onClick={onCancel} aria-label="Close" className="cursor-pointer opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-md">
        <div>
          <label className="text-xs font-medium mb-xs block" style={{ color: 'var(--dash-text-secondary)' }}>Rule name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alert compliance on high-risk transactions"
            className="input-field w-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <div>
            <label className="text-xs font-medium mb-xs block" style={{ color: 'var(--dash-text-secondary)' }}>When this happens (trigger)</label>
            <select value={trigger} onChange={e => setTrigger(e.target.value)} className="input-field w-full">
              {TRIGGERS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium mb-xs block" style={{ color: 'var(--dash-text-secondary)' }}>And this is true (condition)</label>
            <select value={condition} onChange={e => setCondition(e.target.value)} className="input-field w-full">
              {CONDITION_PRESETS.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-sm">
            <label className="text-xs font-medium" style={{ color: 'var(--dash-text-secondary)' }}>Then do (actions)</label>
            <button onClick={addAction}
              className="inline-flex items-center gap-xs text-xs font-semibold cursor-pointer hover:opacity-80"
              style={{ color: '#C9A96E' }}>
              <Plus className="w-3 h-3" /> Add action
            </button>
          </div>
          <div className="space-y-sm">
            {actions.map((a, i) => (
              <div key={i} className="flex gap-sm items-start">
                <select value={a.type} onChange={e => updateAction(i, { type: e.target.value as ActionType })}
                  className="input-field" style={{ maxWidth: 180 }}>
                  {ACTION_TYPES.map(x => <option key={x.v} value={x.v}>{x.l}</option>)}
                </select>
                <input value={a.target} onChange={e => updateAction(i, { target: e.target.value })}
                  placeholder={actionPlaceholder(a.type)} className="input-field flex-1" />
                {actions.length > 1 && (
                  <button onClick={() => removeAction(i)} aria-label="Remove action"
                    className="mt-md opacity-60 hover:opacity-100 cursor-pointer shrink-0">
                    <Trash2 className="w-4 h-4" style={{ color: '#C0392B' }} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && <p role="alert" className="text-sm" style={{ color: '#C0392B' }}>{error}</p>}

        <div className="flex gap-sm justify-end pt-sm">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save rule'}</Button>
        </div>
      </div>
    </Card>
  )
}
