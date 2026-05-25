'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { apiClient } from '@/lib/api-client'

type Rule = {
  route_pattern: string
  requests_per_minute: number
  burst: number
}

type Response = {
  tenant_id: string
  rules: Rule[]
}

const blankRule: Rule = { route_pattern: '/', requests_per_minute: 60, burst: 10 }

export default function RateLimitsPage() {
  const params = useParams<{ id: string }>()
  const tenantId = params?.id ?? ''

  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get<Response>(`/admin/tenants/${tenantId}/rate-limits`)
      .then((r) => {
        if (!cancelled) setRules(r.rules)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(`Could not load rules: ${(e as Error).message}`)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tenantId])

  const updateRule = (i: number, patch: Partial<Rule>) =>
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const removeRule = (i: number) =>
    setRules((prev) => prev.filter((_, idx) => idx !== i))

  const addRule = () => setRules((prev) => [...prev, { ...blankRule }])

  const validate = (): string | null => {
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i]
      if (!r) continue
      if (!r.route_pattern) return `Rule ${i + 1}: route_pattern required`
      if (r.route_pattern !== '*' && !r.route_pattern.startsWith('/')) {
        return `Rule ${i + 1}: route_pattern must start with '/' or be '*'`
      }
      if (r.requests_per_minute <= 0)
        return `Rule ${i + 1}: requests_per_minute must be > 0`
      if (r.burst <= 0) return `Rule ${i + 1}: burst must be > 0`
      if (r.burst > r.requests_per_minute * 10)
        return `Rule ${i + 1}: burst must be <= 10 × requests_per_minute`
    }
    return null
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const v = validate()
    if (v) {
      setError(v)
      return
    }
    setSaving(true)
    try {
      const resp = await apiClient.put<Response>(
        `/admin/tenants/${tenantId}/rate-limits`,
        { rules },
      )
      setRules(resp.rules)
      setSavedAt(new Date())
    } catch (err) {
      setError(`Save failed: ${(err as Error).message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="p-6">Loading rate limits…</p>

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight">Rate limits</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Tenant <code>{tenantId}</code>. Limits are enforced by the gateway via
        a 60-second sliding window. Use <code>*</code> as the route pattern for
        the tenant default.
      </p>

      {error && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}
      {savedAt && (
        <div className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Saved {savedAt.toLocaleTimeString()}.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3" aria-label="Rate-limit rules">
        {rules.map((rule, i) => (
          <div key={i} className="flex items-end gap-2 rounded border p-3">
            <label className="flex-1">
              <span className="block text-xs uppercase text-muted-foreground">Route pattern</span>
              <input
                className="w-full rounded border px-2 py-1"
                value={rule.route_pattern}
                onChange={(e) => updateRule(i, { route_pattern: e.target.value })}
                aria-label={`route_pattern_${i}`}
              />
            </label>
            <label className="w-32">
              <span className="block text-xs uppercase text-muted-foreground">Req / min</span>
              <input
                type="number"
                min={1}
                className="w-full rounded border px-2 py-1"
                value={rule.requests_per_minute}
                onChange={(e) =>
                  updateRule(i, { requests_per_minute: Number(e.target.value) })
                }
                aria-label={`requests_per_minute_${i}`}
              />
            </label>
            <label className="w-32">
              <span className="block text-xs uppercase text-muted-foreground">Burst</span>
              <input
                type="number"
                min={1}
                className="w-full rounded border px-2 py-1"
                value={rule.burst}
                onChange={(e) => updateRule(i, { burst: Number(e.target.value) })}
                aria-label={`burst_${i}`}
              />
            </label>
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm"
              onClick={() => removeRule(i)}
            >
              Remove
            </button>
          </div>
        ))}

        <div className="flex gap-2">
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            onClick={addRule}
          >
            + Add rule
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
