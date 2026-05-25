import { useState, FormEvent } from 'react'
import { Mail, Headphones, Globe, Calendar, Check } from 'lucide-react'
import { submitDemoLead } from '../lib/supabase'

const contacts = [
  { icon: Mail, label: 'Sales', value: 'sales@amliq.finance', href: 'mailto:sales@amliq.finance' },
  { icon: Headphones, label: 'Support', value: 'support@amliq.finance', href: 'mailto:support@amliq.finance' },
  { icon: Globe, label: 'General', value: 'info@amliq.finance', href: 'mailto:info@amliq.finance' },
  { icon: Calendar, label: 'Book a Demo', value: 'Schedule on Calendly', href: 'https://calendly.com/amliq' },
]

export default function ContactPage() {
  return (
    <div className="bg-token-bg min-h-screen">
      <section className="py-16 sm:py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-semibold text-token-fg tracking-tight">
              Contact Sales
            </h1>
            <p className="mt-4 text-lg text-token-fg-muted max-w-2xl mx-auto">
              Talk to our team about sanctions screening for your organization
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-10">
            <ContactForm />
            <ContactInfo />
          </div>
          <p className="mt-12 text-sm text-token-fg-faint text-center max-w-2xl mx-auto">
            Enterprise customers can also request a dedicated security review
            and custom deployment options.
          </p>
        </div>
      </section>
    </div>
  )
}

interface FormState {
  name: string
  email: string
  company: string
  message: string
}

function ContactForm() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', company: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError('Please fill in name, email, and message.')
      return
    }
    setStatus('loading')
    const use_case = `From: ${form.name}\n\n${form.message}`
    const { error: err } = await submitDemoLead({
      email: form.email,
      company: form.company || undefined,
      use_case,
      source: 'contact-page',
    })
    if (err) {
      setStatus('error')
      setError(err.message || 'Submission failed. Email sales@amliq.finance directly.')
      return
    }
    setStatus('ok')
  }

  if (status === 'ok') {
    return (
      <div
        className="flex flex-col items-start gap-3 p-6 rounded-lg"
        style={{
          background: 'var(--accent-gold-light)',
          border: '1px solid color-mix(in srgb, var(--accent-gold) 35%, transparent)',
        }}
      >
        <div className="flex items-center gap-2">
          <Check className="w-5 h-5 text-token-gold" />
          <p className="text-base font-semibold text-token-fg">Message received</p>
        </div>
        <p className="text-sm text-token-fg-muted">
          Thanks. Our team will reach out within one business day at{' '}
          <span className="text-token-fg font-medium">{form.email}</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus('idle')
            setForm({ name: '', email: '', company: '', message: '' })
          }}
          className="text-sm font-medium text-token-fg-muted hover:text-token-fg underline"
        >
          Send another message
        </button>
      </div>
    )
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} noValidate>
      <Field label="Name" name="name" type="text" placeholder="Your full name" value={form.name} onChange={update('name')} required />
      <Field label="Email" name="email" type="email" placeholder="you@company.com" value={form.email} onChange={update('email')} required />
      <Field label="Company" name="company" type="text" placeholder="Company name" value={form.company} onChange={update('company')} />
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-token-fg-muted mb-1">Message</label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="How can we help?"
          value={form.message}
          onChange={update('message')}
          required
          className="w-full rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent"
          style={{
            background: 'var(--bg-elevated)',
            color: 'var(--text)',
            border: '1px solid var(--separator)',
            boxShadow: 'var(--shadow-xs)',
          }}
        />
      </div>
      {error && <p className="text-sm" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full px-6 py-3 text-base font-semibold rounded-lg transition-all duration-200 hover:-translate-y-px min-h-[44px] disabled:opacity-60"
        style={{ background: 'var(--accent-gold)', color: '#0A0908' }}
      >
        {status === 'loading' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  )
}

interface FieldProps {
  label: string
  name: string
  type: string
  placeholder: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  required?: boolean
}

function Field({ label, name, type, placeholder, value, onChange, required }: FieldProps) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-token-fg-muted mb-1">
        {label}{required && <span className="ml-0.5" style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:border-transparent min-h-[44px]"
        style={{
          background: 'var(--bg-elevated)',
          color: 'var(--text)',
          border: '1px solid var(--separator)',
          boxShadow: 'var(--shadow-xs)',
        }}
      />
    </div>
  )
}

function ContactInfo() {
  return (
    <div className="space-y-4">
      {contacts.map(c => {
        const isExternal = c.href.startsWith('http')
        return (
          <a
            key={c.label}
            href={c.href}
            {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="flex items-start gap-4 p-4 rounded-lg transition-colors min-h-[44px]"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--separator)',
            }}
          >
            <c.icon className="w-5 h-5 mt-0.5 shrink-0 text-token-gold" />
            <div>
              <p className="text-sm font-semibold text-token-fg">{c.label}</p>
              <p className="text-sm text-token-fg-muted">{c.value}</p>
            </div>
          </a>
        )
      })}
    </div>
  )
}
