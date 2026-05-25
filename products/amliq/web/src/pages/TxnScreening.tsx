import { useState } from 'react'
import { PageHeader } from '../components/layout/PageHeader'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { api } from '../api/client'
import { TxnResultCard } from '../components/screening/TxnResultCard'

interface TxnResult {
  decision: string; txn_id: string; risk_flags: string[];
  sender_hits: any[]; receiver_hits: any[];
  case_id: string; processing_ms: number;
}

export function TxnScreening() {
  const [form, setForm] = useState({
    txn_id: '', sender_name: '', sender_country: '',
    receiver_name: '', receiver_country: '',
    amount_cents: 0, currency: 'USD',
  })
  const [result, setResult] = useState<TxnResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, v: string | number) => setForm({ ...form, [k]: v })

  const screen = async () => {
    if (!form.sender_name.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const d = await api.post<TxnResult>('/txn/screen', form)
      setResult(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Screening failed')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <PageHeader title="Transaction Screening"
        description="Screen payment sender & receiver against sanctions + FATF lists" />
      <Card className="mb-lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md mb-md">
          <input placeholder="Sender name *" value={form.sender_name}
            onChange={e => set('sender_name', e.target.value)} className="input-field" />
          <input placeholder="Sender country (e.g. IR)" value={form.sender_country}
            onChange={e => set('sender_country', e.target.value)} className="input-field" />
          <input placeholder="Receiver name" value={form.receiver_name}
            onChange={e => set('receiver_name', e.target.value)} className="input-field" />
          <input placeholder="Receiver country" value={form.receiver_country}
            onChange={e => set('receiver_country', e.target.value)} className="input-field" />
          <input placeholder="Amount (cents)" type="number" value={form.amount_cents || ''}
            onChange={e => set('amount_cents', +e.target.value)} className="input-field" />
          <select value={form.currency} onChange={e => set('currency', e.target.value)}
            className="input-field">
            {['USD', 'EUR', 'GBP', 'ILS', 'CHF', 'JPY'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <Button onClick={screen} disabled={loading || !form.sender_name.trim()} className="w-full">
          {loading ? 'Screening...' : 'Screen Transaction'}
        </Button>
      </Card>
      {loading && <LoadingSpinner />}
      {error && <Card><p role="alert" className="text-red-500 sf-body">{error}</p></Card>}
      {result && <TxnResultCard result={result} />}
    </div>
  )
}

export default TxnScreening
