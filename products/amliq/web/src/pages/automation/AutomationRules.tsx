import { useState, useEffect } from 'react'
import { Plus, Zap, Trash2 } from 'lucide-react'
import { PageHeader } from '../../components/layout/PageHeader'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { api } from '../../api/client'
import { RuleBuilder, AutomationRule } from '../../components/automation/RuleBuilder'

export default function AutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showBuilder, setShowBuilder] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const d = await api.get<{ rules: AutomationRule[] }>('/automation/rules')
      setRules(d?.rules ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const removeRule = async (id: string) => {
    if (!confirm('Delete this rule? Events matching it will no longer trigger actions.')) return
    try { await api.del(`/automation/rules/${id}`); load() }
    catch (err) { setError(err instanceof Error ? err.message : 'Delete failed') }
  }

  return (
    <div>
      <PageHeader
        title="Automations"
        description="Build no-code rules that run when events arrive. When a customer is created from your CRM, a transaction comes in via webhook, or a screening match fires — decide who gets alerted (email / SMS), or forward the event to another webhook."
      />

      <Card className="mb-lg">
        <div className="flex items-start gap-md">
          <div className="flex items-center justify-center w-9 h-9 rounded-apple-md shrink-0"
            style={{ background: 'rgba(201,169,110,0.1)' }}>
            <Zap className="w-4.5 h-4.5" style={{ color: '#C9A96E' }} />
          </div>
          <div className="flex-1">
            <p className="sf-body mb-sm" style={{ color: 'var(--dash-text)' }}>
              Every rule has three parts:
            </p>
            <ul className="text-sm space-y-xs" style={{ color: 'var(--dash-text-secondary)' }}>
              <li><strong>Trigger</strong> — which event fires the rule (e.g. <code>customer.created</code>, <code>alert.opened</code>, <code>match.found</code>).</li>
              <li><strong>Condition</strong> — optional filter (e.g. severity ≥ high, country is FATF-listed, amount &gt; $10,000).</li>
              <li><strong>Actions</strong> — one or more of: email an analyst, send an SMS, forward to an outgoing webhook, open a case.</li>
            </ul>
          </div>
          <Button onClick={() => setShowBuilder(true)} className="inline-flex items-center gap-sm shrink-0">
            <Plus className="w-4 h-4" /> New rule
          </Button>
        </div>
      </Card>

      {showBuilder && <RuleBuilder onSave={() => { setShowBuilder(false); load() }}
        onCancel={() => setShowBuilder(false)} />}

      {error && <Card className="mb-lg"><p role="alert" className="text-sm" style={{ color: '#C0392B' }}>{error}</p></Card>}

      {loading ? null : rules.length === 0 ? (
        <EmptyState title="No automations yet" />
      ) : (
        <div className="space-y-sm">
          {rules.map(r => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-md">
                <div className="flex-1">
                  <div className="flex items-center gap-sm mb-xs flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: 'var(--dash-text)' }}>{r.name}</p>
                    <Badge size="sm" color={r.enabled ? 'green' : 'gray'}>
                      {r.enabled ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--dash-text-secondary)' }}>
                    When <code>{r.trigger}</code>
                    {r.condition ? <> and <code>{r.condition}</code></> : null}
                    {' → '}
                    {r.actions.map(a => a.type).join(', ')}
                  </p>
                </div>
                <button onClick={() => removeRule(r.id)} aria-label="Delete rule"
                  className="opacity-60 hover:opacity-100 cursor-pointer shrink-0">
                  <Trash2 className="w-4 h-4" style={{ color: '#C0392B' }} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
