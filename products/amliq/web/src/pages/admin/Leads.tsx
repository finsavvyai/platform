import { useEffect, useState } from 'react'
import { Mail, Building2, Inbox, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Lead = {
  id: string
  email: string
  company: string | null
  use_case: string | null
  source: string | null
  created_at: string
}

export default function AdminLeads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('demo_leads')
      .select('id,email,company,use_case,source,created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) setError(error.message)
    setLeads((data as Lead[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase mb-1" style={{ color: '#C9A96E' }}>
            Admin
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Demo & API access leads</h1>
          <p className="text-sm text-slate-500 mt-1">Captured from the homepage hero and closing CTA.</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-5 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_0.7fr_0.8fr] gap-4 px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500 bg-slate-50 border-b border-slate-200">
          <span>Email</span>
          <span>Company</span>
          <span>Use case</span>
          <span>Source</span>
          <span className="text-right">Captured</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading leads…</div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-6 h-6 mx-auto mb-3 text-slate-400" />
            <p className="text-sm text-slate-500">No leads captured yet.</p>
          </div>
        ) : (
          leads.map((l) => (
            <div
              key={l.id}
              className="grid grid-cols-[1.4fr_1fr_1fr_0.7fr_0.8fr] gap-4 px-5 py-3.5 text-sm border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="text-slate-900 truncate">{l.email}</span>
              </div>
              <div className="flex items-center gap-2 min-w-0 text-slate-600">
                {l.company ? <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /> : null}
                <span className="truncate">{l.company || '—'}</span>
              </div>
              <span className="text-slate-600 truncate">{l.use_case || '—'}</span>
              <span className="text-xs font-mono text-slate-500">{l.source || '—'}</span>
              <span className="text-right text-xs text-slate-500">
                {new Date(l.created_at).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-slate-400 mt-4">
        Read access is restricted to users with the <code className="font-mono">admin</code> role via RLS.
      </p>
    </div>
  )
}
