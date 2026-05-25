import { useState } from 'react'
import { btnGesturePrimary } from '../styles/gestures'

type Topic = 'sales' | 'enterprise' | 'support' | 'security' | 'press' | 'other'

interface Props {
  topic: Topic
}

const ROLES = ['Founder / CEO', 'CTO / VP Eng', 'Eng Manager', 'Staff / Principal', 'Senior engineer', 'DevOps / Platform', 'Security', 'IC engineer', 'Other']
const TEAM_SIZES = ['1–5', '6–20', '21–50', '51–200', '201–500', '500+']
const STACKS = ['Node.js', 'Go', 'Python', 'Rust', 'Java', 'Kotlin', 'Ruby', 'PHP', '.NET', 'Elixir', 'Swift / iOS', 'Android', 'React', 'Next.js', 'Vue', 'Django', 'Rails']
const CURRENT_CIS = ['GitHub Actions', 'GitLab CI', 'CircleCI', 'Jenkins', 'Travis CI', 'Buildkite', 'Drone', 'None yet', 'Homegrown', 'Other']
const BUDGETS = ['< $1k / mo', '$1k–5k / mo', '$5k–20k / mo', '$20k+ / mo', 'TBD']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-t3 uppercase tracking-wider">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  )
}

const inputBase =
  'w-full rounded-lg bg-root/60 border border-border-base px-4 py-3 text-sm text-t1 placeholder-t3 outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]'

export function ContactForm({ topic }: Props) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle')
  const [error, setError] = useState('')
  const [stack, setStack] = useState<string[]>([])

  function toggleStack(s: string) {
    setStack(cur => (cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setStatus('sending')
    setError('')
    try {
      const res = await fetch('https://api.pushci.dev/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          name: f.get('name'),
          email: f.get('email'),
          company: f.get('company'),
          role: f.get('role'),
          team_size: f.get('team_size'),
          stack,
          current_ci: f.get('current_ci'),
          budget: f.get('budget'),
          message: f.get('message'),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || `HTTP ${res.status}`)
      }
      setStatus('ok')
    } catch (err) {
      setStatus('err')
      setError(err instanceof Error ? err.message : 'send failed')
    }
  }

  if (status === 'ok') {
    return (
      <div className="relative rounded-2xl border border-accent/40 bg-accent/5 p-10 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.18),transparent_60%)]" />
        <div className="relative">
          <div className="inline-flex w-14 h-14 rounded-full bg-accent/20 items-center justify-center mb-5">
            <svg className="w-7 h-7 text-accent" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h3 className="text-2xl font-bold text-t1">Message received</h3>
          <p className="mt-2 text-t2 text-sm">We reply within one business day. Check your inbox.</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="relative rounded-2xl border border-border-base bg-surface/40 p-7 overflow-hidden">
      <div aria-hidden className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      <div aria-hidden className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
      <div className="relative space-y-5">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Your name"><input required name="name" autoComplete="name" className={inputBase} placeholder="Jane Doe" /></Field>
          <Field label="Work email"><input required type="email" name="email" autoComplete="email" className={inputBase} placeholder="jane@company.com" /></Field>
          <Field label="Company"><input name="company" autoComplete="organization" className={inputBase} placeholder="Acme Corp" /></Field>
          <Field label="Your role">
            <select name="role" className={inputBase} defaultValue="">
              <option value="" disabled>Select…</option>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Team size">
            <select name="team_size" className={inputBase} defaultValue="">
              <option value="" disabled>Select…</option>
              {TEAM_SIZES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Current CI">
            <select name="current_ci" className={inputBase} defaultValue="">
              <option value="" disabled>Select…</option>
              {CURRENT_CIS.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Stack (pick any that apply)">
          <div className="flex flex-wrap gap-2">
            {STACKS.map(s => (
              <button type="button" key={s} onClick={() => toggleStack(s)}
                className={`rounded-full px-3 py-1.5 text-xs border transition-all ${
                  stack.includes(s)
                    ? 'bg-accent text-root border-accent shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                    : 'bg-root/40 text-t2 border-border-base hover:border-border-em'
                }`}
              >{s}</button>
            ))}
          </div>
        </Field>
        <Field label="Budget (optional)">
          <select name="budget" className={inputBase} defaultValue="">
            <option value="" disabled>Select…</option>
            {BUDGETS.map(b => <option key={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="What are you trying to solve?">
          <textarea required name="message" rows={5} maxLength={5000}
            className={`${inputBase} resize-y`}
            placeholder="Tell us about your pipelines, pain points, timelines, compliance needs…"
          />
        </Field>
        {error && <p className="text-sm text-red-400">Error: {error}</p>}
        <button type="submit" disabled={status === 'sending'}
          className={`relative w-full rounded-lg px-6 py-3 text-sm font-semibold text-root overflow-hidden transition-all
            bg-gradient-to-r from-accent via-emerald-400 to-accent bg-[length:200%_100%]
            hover:bg-[position:100%_0] focus-glow disabled:opacity-60 ${btnGesturePrimary}`}
        >
          {status === 'sending' ? 'Sending…' : 'Send to sales@pushci.dev'}
        </button>
        <p className="text-xs text-t3 text-center">
          By submitting you agree to our <a className="underline hover:text-t2" href="/privacy">Privacy Policy</a>. We&rsquo;ll never share your info.
        </p>
      </div>
    </form>
  )
}
