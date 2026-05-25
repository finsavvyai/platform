import { useState } from 'react'
import { Link } from 'react-router-dom'
import { btnGesturePrimary, btnGestureSubtle, navGesture } from '../styles/gestures'

const compareLinks = [
  { label: 'vs GitHub Actions', href: '/vs/github-actions' },
  { label: 'vs GitLab CI', href: '/vs/gitlab-ci' },
  { label: 'vs CircleCI', href: '/vs/circleci' },
  { label: 'vs Jenkins', href: '/vs/jenkins' },
  { label: 'vs Travis CI', href: '/vs/travis-ci' },
  { label: 'vs Buildkite', href: '/vs/buildkite' },
  { label: 'vs Drone CI', href: '/vs/drone-ci' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)

  const closeMenu = () => setOpen(false)

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-border-base/60 bg-root/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1080px] items-center justify-between px-4 sm:px-6 h-16">
        <Link to="/" className="text-[15px] font-bold tracking-tight text-t1" onClick={closeMenu}>
          push<span className="text-accent">ci</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 lg:flex">
          <Link to="/product" className={`text-body text-t2 hover:text-t1 transition-colors duration-200 ${navGesture}`}>Product</Link>
          <Link to="/developers" className={`text-body text-t2 hover:text-t1 transition-colors duration-200 ${navGesture}`}>Developers</Link>
          <Link to="/pricing" className={`text-body text-t2 hover:text-t1 transition-colors duration-200 ${navGesture}`}>Pricing</Link>
          <Link to="/enterprise" className={`text-body text-t2 hover:text-t1 transition-colors duration-200 ${navGesture}`}>Enterprise</Link>
          <Link to="/docs" className={`text-body text-t2 hover:text-t1 transition-colors duration-200 ${navGesture}`}>Docs</Link>
          <div className="relative" onMouseEnter={() => setCompareOpen(true)} onMouseLeave={() => setCompareOpen(false)}>
            <button className="text-body text-t2 hover:text-t1 transition-colors duration-200">Compare</button>
            {compareOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 rounded-lg border border-border-base bg-surface py-1.5 shadow-xl shadow-black/30">
                {compareLinks.map((c) => (
                  <Link key={c.href} to={c.href} className="block px-4 py-1.5 text-body text-t2 hover:bg-raised hover:text-t1 transition-colors duration-150">
                    {c.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-4">
          <Link to="/contact" className="text-body text-t2 hover:text-t1 transition-colors duration-200">Contact</Link>
          <a href="https://app.pushci.dev" className={`rounded-lg bg-t1 px-4 py-1.5 text-body font-medium text-root hover:bg-white focus-glow ${btnGesturePrimary}`}>
            Start building
          </a>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className={`lg:hidden text-t2 p-1 ${btnGestureSubtle}`} aria-label={open ? 'Close menu' : 'Open menu'}>
          <svg className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {open
              ? <path strokeLinecap="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              : <path strokeLinecap="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border-base/60 px-4 sm:px-6 py-4 lg:hidden flex flex-col gap-1 max-h-[80vh] overflow-y-auto bg-root/95 backdrop-blur-xl">
          <Link to="/product" className="text-sm text-t2 hover:text-t1 py-2" onClick={closeMenu}>Product</Link>
          <Link to="/developers" className="text-sm text-t2 hover:text-t1 py-2" onClick={closeMenu}>Developers</Link>
          <Link to="/pricing" className="text-sm text-t2 hover:text-t1 py-2" onClick={closeMenu}>Pricing</Link>
          <Link to="/docs" className="text-sm text-t2 hover:text-t1 py-2" onClick={closeMenu}>Docs</Link>
          <Link to="/enterprise" className="text-sm text-t2 hover:text-t1 py-2" onClick={closeMenu}>Enterprise</Link>
          <Link to="/contact" className="text-sm text-t2 hover:text-t1 py-2" onClick={closeMenu}>Contact</Link>
          <Link to="/tools/cost-calculator" className="text-sm text-t2 hover:text-t1 py-2" onClick={closeMenu}>Cost Calculator</Link>
          <Link to="/ai" className="text-sm text-t2 hover:text-t1 py-2" onClick={closeMenu}>AI Agents</Link>
          <Link to="/skills" className="text-sm text-t2 hover:text-t1 py-2" onClick={closeMenu}>Skills</Link>
          <div className="border-t border-border-base/40 mt-2 pt-2">
            <p className="text-caption font-medium text-t3 uppercase tracking-wider mb-1">Compare</p>
            {compareLinks.map((c) => (
              <Link key={c.href} to={c.href} className="text-sm text-t2 hover:text-t1 py-2 block" onClick={closeMenu}>{c.label}</Link>
            ))}
          </div>
          <a href="https://app.pushci.dev" className={`rounded-lg bg-t1 px-4 py-2.5 text-sm font-medium text-root text-center mt-3 ${btnGesturePrimary}`} onClick={closeMenu}>
            Start building
          </a>
        </div>
      )}
    </nav>
  )
}
