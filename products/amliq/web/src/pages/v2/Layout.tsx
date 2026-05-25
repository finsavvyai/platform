import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, ArrowRight } from 'lucide-react'
import { Button, Container, tok, cx } from './ui'

const NAV = [
  { label: 'Product', href: '/product' },
  { label: 'Developers', href: '/docs' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Security', href: '/security' },
  { label: 'Docs', href: '/docs' },
]

export function V2Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cx(
        'sticky top-0 z-50 transition-colors',
        scrolled ? 'backdrop-blur' : '',
      )}
      style={{
        background: scrolled ? 'rgba(5,11,24,0.85)' : 'transparent',
        borderBottom: scrolled ? `1px solid ${tok.borderMuted}` : '1px solid transparent',
      }}
    >
      <Container className="flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-bold"
            style={{ background: tok.gold, color: tok.bg }}
          >
            A
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">AMLIQ</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((n) => (
            <a
              key={n.label}
              href={n.href}
              className="text-sm font-medium transition-colors hover:text-white"
              style={{ color: tok.textSec }}
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Button as="a" href="/contact" variant="secondary">
            Book demo
          </Button>
          <Button as="a" href="/signup" variant="primary">
            Start screening <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <button
          className="flex h-10 w-10 items-center justify-center rounded-md text-white lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          style={{ border: `1px solid ${tok.border}` }}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </Container>

      {open && (
        <div
          className="lg:hidden"
          style={{ background: tok.bg, borderTop: `1px solid ${tok.borderMuted}` }}
        >
          <Container className="flex flex-col gap-1 py-4">
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                className="rounded-md px-3 py-3 text-sm font-medium"
                style={{ color: tok.textSec }}
                onClick={() => setOpen(false)}
              >
                {n.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <Button as="a" href="/contact" variant="secondary" size="lg">
                Book demo
              </Button>
              <Button as="a" href="/signup" variant="primary" size="lg">
                Start screening
              </Button>
            </div>
          </Container>
        </div>
      )}
    </header>
  )
}

export function V2Footer() {
  const cols = [
    {
      title: 'Product',
      items: ['Overview', 'Screening', 'Risk Scoring', 'Case Management'],
    },
    { title: 'Developers', items: ['Docs', 'API Reference', 'SDKs', 'Status'] },
    { title: 'Security', items: ['Security', 'Compliance', 'Trust', 'Disclosure'] },
    { title: 'Company', items: ['About', 'Careers', 'Contact', 'Blog'] },
    { title: 'Legal', items: ['Terms', 'Privacy', 'DPA'] },
  ]
  return (
    <footer style={{ borderTop: `1px solid ${tok.borderMuted}`, background: tok.bg }}>
      <Container className="py-14">
        <div className="grid gap-10 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-7 w-7 items-center justify-center rounded-md text-[13px] font-bold"
                style={{ background: tok.gold, color: tok.bg }}
              >
                A
              </span>
              <span className="text-[15px] font-semibold tracking-tight text-white">AMLIQ</span>
            </div>
            <p className="mt-4 max-w-xs text-sm" style={{ color: tok.textMuted }}>
              Real-time sanctions screening and compliance decisioning for regulated financial
              flows.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: tok.textMuted }}
              >
                {c.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {c.items.map((i) => (
                  <li key={i}>
                    <a
                      href="#"
                      className="text-sm hover:text-white"
                      style={{ color: tok.textSec }}
                    >
                      {i}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div
          className="mt-12 flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: `1px solid ${tok.borderMuted}` }}
        >
          <div className="text-xs" style={{ color: tok.textMuted }}>
            © {new Date().getFullYear()} AMLIQ. Compliance infrastructure for payments.
          </div>
          <div className="text-xs" style={{ color: tok.textMuted }}>
            SOC 2 aligned · GDPR · Audit-ready
          </div>
        </div>
      </Container>
    </footer>
  )
}

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: tok.bg, color: tok.text }}>
      <V2Nav />
      <main>{children}</main>
      <V2Footer />
    </div>
  )
}
