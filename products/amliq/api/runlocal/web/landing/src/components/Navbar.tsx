import { useState } from 'react'
import { Link } from 'react-router-dom'

const compareLinks = [
  { label: 'vs GitHub Actions', href: '/vs/github-actions' },
  { label: 'vs GitLab CI', href: '/vs/gitlab-ci' },
  { label: 'vs CircleCI', href: '/vs/circleci' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const links = ['Features', 'Pricing', 'Docs', 'Tools']

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-bold tracking-tight">
          <span className="text-emerald-400">Push</span>CI
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) =>
            l === 'Tools' ? (
              <Link key={l} to="/tools/cost-calculator" className="text-sm text-zinc-400 hover:text-white transition">
                {l}
              </Link>
            ) : (
              <a key={l} href={`/#${l.toLowerCase()}`} className="text-sm text-zinc-400 hover:text-white transition">
                {l}
              </a>
            )
          )}
          <div className="relative" onMouseEnter={() => setCompareOpen(true)} onMouseLeave={() => setCompareOpen(false)}>
            <button className="text-sm text-zinc-400 hover:text-white transition">Compare</button>
            {compareOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 rounded-lg border border-zinc-800 bg-zinc-900 py-2 shadow-xl">
                {compareLinks.map((c) => (
                  <Link key={c.href} to={c.href} className="block px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition">
                    {c.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <a href="#" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 transition">
            Get Started
          </a>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden text-zinc-400" aria-label="Menu">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open
              ? <path strokeLinecap="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>
      {open && (
        <div className="border-t border-zinc-800 px-6 py-4 md:hidden flex flex-col gap-4">
          {links.map((l) =>
            l === 'Tools' ? (
              <Link key={l} to="/tools/cost-calculator" className="text-sm text-zinc-400">{l}</Link>
            ) : (
              <a key={l} href={`/#${l.toLowerCase()}`} className="text-sm text-zinc-400">{l}</a>
            )
          )}
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mt-2">Compare</p>
          {compareLinks.map((c) => (
            <Link key={c.href} to={c.href} className="text-sm text-zinc-400">{c.label}</Link>
          ))}
          <a href="#" className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black text-center">
            Get Started
          </a>
        </div>
      )}
    </nav>
  )
}
