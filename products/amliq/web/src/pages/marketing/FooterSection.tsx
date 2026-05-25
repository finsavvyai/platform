import { Link } from 'react-router-dom'
import Logo from '../../components/brand/Logo'

const columns = [
  { title: 'Product', links: [
    { label: 'Product', href: '/product' },
    { label: 'Matching Engine', href: '#engine' },
    { label: 'API', href: '/docs' },
    { label: 'Pricing', href: '#pricing' },
  ]},
  { title: 'Company', links: [
    { label: 'About', href: '/about' }, { label: 'Blog', href: '/blog' },
    { label: 'Careers', href: '/careers' }, { label: 'Contact', href: '/contact' },
  ]},
  { title: 'Resources', links: [
    { label: 'Documentation', href: '/docs' }, { label: 'Security', href: '/security' },
    { label: 'Changelog', href: '/changelog' }, { label: 'Status', href: '/status' },
  ]},
  { title: 'Legal', links: [
    { label: 'Privacy Policy', href: '/privacy' }, { label: 'Terms of Service', href: '/terms' },
    { label: 'Compliance', href: '/compliance' }, { label: 'DPA', href: '/dpa' },
  ]},
]

export default function FooterSection() {
  return (
    <footer className="pt-16 pb-8 px-4" style={{ borderTop: '1px solid var(--separator)', background: 'var(--bg-secondary)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Logo size={24} />
            <p className="text-sm leading-relaxed mt-4" style={{ color: 'var(--text-secondary)' }}>
              Sanctions screening infrastructure for fintech, payments, and regulated institutions.
            </p>
            <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
              info@amliq.finance
            </p>
          </div>
          {columns.map(col => (
            <div key={col.title}>
              <p className="section-eyebrow mb-4">{col.title}</p>
              <ul className="space-y-2.5">
                {col.links.map(l => (
                  <li key={l.label}>
                    <Link to={l.href}
                      className="text-sm transition-colors duration-200"
                      style={{ color: 'var(--text-secondary)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="boutique-divider mb-6" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            &copy; 2026 AMLIQ. All rights reserved.
          </p>
          <div className="flex gap-5">
            <Link to="/privacy" className="text-xs transition-colors duration-200"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
              Privacy
            </Link>
            <Link to="/terms" className="text-xs transition-colors duration-200"
              style={{ color: 'var(--text-tertiary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
