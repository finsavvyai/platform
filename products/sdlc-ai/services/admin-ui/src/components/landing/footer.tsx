import { Github, Twitter, Linkedin, Shield } from 'lucide-react'

const productLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Docs', href: '/docs' },
  { label: 'API Reference', href: '/docs/api' },
  { label: 'Changelog', href: '/changelog' },
]

const companyLinks = [
  { label: 'About', href: '/about' },
  { label: 'Blog', href: '/blog' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/contact' },
  { label: 'Security', href: '/security' },
]

const legalLinks = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Cookie Policy', href: '/cookies' },
  { label: 'DPA', href: '/dpa' },
  { label: 'SLA', href: '/sla' },
]

const socialLinks = [
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
]

const complianceBadges = ['SOC 2', 'HIPAA', 'GDPR', 'PCI-DSS']

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="cursor-pointer text-sm text-slate-500 transition-colors duration-200 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="py-16 px-6 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="grid md:grid-cols-4 gap-8 max-w-6xl mx-auto">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-800" />
            <span className="text-lg font-bold text-slate-900 dark:text-white">SDLC.ai</span>
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            Enterprise-grade secure data learning platform.
          </p>
          <div className="mt-4 flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                aria-label={social.label}
                className="cursor-pointer p-2 -m-2 text-slate-400 transition-colors duration-200 hover:text-slate-900 dark:hover:text-white"
              >
                <social.icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>

        <FooterColumn title="Product" links={productLinks} />
        <FooterColumn title="Company" links={companyLinks} />
        <FooterColumn title="Legal" links={legalLinks} />
      </div>

      <div className="mt-12 flex flex-col items-center gap-4 border-t border-slate-200 pt-8 dark:border-slate-800 max-w-6xl mx-auto sm:flex-row sm:justify-between">
        <p className="text-sm text-slate-400">
          &copy; 2026 SDLC.ai. All rights reserved.
        </p>
        <div className="flex items-center gap-3">
          {complianceBadges.map((badge) => (
            <span
              key={badge}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400"
            >
              {badge}
            </span>
          ))}
        </div>
      </div>
    </footer>
  )
}
