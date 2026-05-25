'use client';

import Link from 'next/link';
import { Shield } from 'lucide-react';

const footerLinks = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Quick Start', href: '/docs' },
  { label: 'SDKs', href: '/docs/integrations' },
  { label: 'SIEM', href: '/docs/siem' },
];

export function FooterSection(): React.ReactElement {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="mx-auto max-w-7xl px-6 flex flex-col items-center gap-4 md:flex-row md:justify-between">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Shield className="h-4 w-4" />
          <span>&copy; {new Date().getFullYear()} TokenForge. Built by{' '}
            <a
              href="https://opensyber.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition"
            >
              OpenSyber
            </a>
            .
          </span>
        </div>
        <div className="flex gap-6 text-sm text-text-muted">
          {footerLinks.map((link) => (
            <Link key={link.label} href={link.href} className="hover:text-text-primary transition">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}
