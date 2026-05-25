import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from '../../components/brand/Logo'
import MobileMenu from './MobileMenu'
import ThemeSwitcher from '../../components/marketing/ThemeSwitcher'
import { useMarketingTheme } from '../../context/MarketingThemeContext'

const links = [
  { label: 'Product', href: '/product' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Security', href: '/security' },
  { label: 'Docs', href: '/docs' },
  { label: 'About', href: '/about' },
]

export default function MarketingNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()
  const { theme } = useMarketingTheme()
  const isLight = theme === 'light'

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 backdrop-blur-2xl"
        style={{
          background: scrolled
            ? 'color-mix(in srgb, var(--bg) 88%, transparent)'
            : 'color-mix(in srgb, var(--bg) 55%, transparent)',
          borderBottom: `1px solid ${scrolled ? 'var(--separator)' : 'var(--separator-subtle)'}`,
          boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo size={24} variant={isLight ? 'dark' : 'light'} />
          <div className="hidden md:flex items-center gap-7">
            {links.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="text-sm font-medium transition-colors duration-200"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <ThemeSwitcher />
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm font-medium transition-colors duration-200 cursor-pointer px-3 py-2"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => navigate('/contact')}
              className="px-5 py-2.5 text-sm font-semibold rounded-[10px] cursor-pointer transition-all duration-200 hover:-translate-y-px"
              style={{
                background: 'var(--accent-gold)',
                color: '#0A0908',
                boxShadow: '0 4px 12px rgba(201,169,110,0.25)',
              }}
            >
              Book a Demo
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 -mr-2 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            style={{ color: 'var(--text)' }}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>
      {open && <MobileMenu onClose={() => setOpen(false)} />}
    </>
  )
}
