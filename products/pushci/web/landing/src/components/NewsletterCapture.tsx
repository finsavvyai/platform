import { useState } from 'react'
import { btnGesturePrimary } from '../styles/gestures'

export function NewsletterCapture() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) return
    setStatus('sending')
    try {
      await fetch('https://api.pushci.dev/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setStatus('done')
      setEmail('')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-accent">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        You're in. We'll keep it useful.
      </div>
    )
  }

  // w-full + min-w-0 on the input is the standard flexbox fix for
  // children overflowing their parent. Without min-w-0 the input's
  // implicit min-width is its placeholder text size
  // ("you@company.com" ≈ 175px), which plus the Subscribe button +
  // gap exceeded the footer grid column (~240px at lg) and the
  // Subscribe button overlapped the adjacent Product column's
  // "Skill Market" link.
  return (
    <form onSubmit={submit} className="flex gap-2 w-full max-w-sm">
      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
        placeholder="you@company.com"
        className="flex-1 min-w-0 rounded-lg bg-surface border border-border-base px-3 py-2 text-sm text-t1 focus:border-accent focus:outline-none transition-colors" />
      <button type="submit" disabled={status === 'sending'}
        className={`shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-root hover:bg-accent-light disabled:opacity-50 ${btnGesturePrimary}`}>
        {status === 'sending' ? '...' : 'Subscribe'}
      </button>
    </form>
  )
}
