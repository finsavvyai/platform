import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const links = [
  { name: 'Why self-host', href: '#why-self-host' },
  { name: 'What’s included', href: '#whats-included' },
  { name: 'How it protects privilege', href: '#privilege' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'FAQ', href: '#faq' },
];

const LawHeader = () => {
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 border-b law-rule"
      style={{ background: 'rgba(245, 241, 232, 0.92)', backdropFilter: 'blur(10px)' }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
        <a href="#top" className="flex items-baseline gap-2" aria-label="sdlc.cc home">
          <span
            className="text-base font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
          >
            sdlc.cc
          </span>
          <span className="law-muted text-xs">LLM gateway for law firms</span>
        </a>

        <nav className="hidden md:flex items-center gap-7" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm law-muted hover:text-[color:var(--law-ink)] transition-colors"
              style={{ fontFamily: 'var(--font-heading, Inter), system-ui' }}
            >
              {l.name}
            </a>
          ))}
          <a
            href="https://github.com/finsavvyai/sdlc-platform"
            className="law-btn-secondary"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>

        <button
          type="button"
          className="md:hidden p-2"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <nav
          className="md:hidden border-t law-rule px-5 py-3 flex flex-col gap-2"
          aria-label="Mobile"
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm law-muted py-1"
              onClick={() => setOpen(false)}
            >
              {l.name}
            </a>
          ))}
          <a
            href="https://github.com/finsavvyai/sdlc-platform"
            className="text-sm font-semibold py-1"
            rel="noopener noreferrer"
          >
            GitHub repository
          </a>
        </nav>
      )}
    </header>
  );
};

export default LawHeader;
