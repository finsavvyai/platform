'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Pricing', href: '/pricing' },
  { label: 'Skills', href: '/marketplace' },
  { label: 'Docs', href: '/docs' },
  { label: 'Blog', href: '/blog' },
  { label: 'Demo', href: '/demo' },
  { label: 'Threat Intel', href: '/threats' },
];

export function MobileNav({ isSignedIn }: { isSignedIn: boolean }) {
  const [open, setOpen] = useState(false);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="text-white p-2"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-in drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-void text-white flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Close button */}
        <div className="flex justify-end p-4">
          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="p-2 rounded-lg hover:bg-surface transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex flex-col items-center gap-6 mt-8 flex-1 px-6">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="text-xl font-medium hover:text-signal transition-colors w-full text-center py-2 rounded-lg hover:bg-surface"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom auth link */}
        <div className="p-8 flex justify-center border-t border-border">
          <Link
            href={isSignedIn ? '/dashboard' : '/sign-in'}
            onClick={() => setOpen(false)}
            className="rounded-lg bg-[#0F766E] px-6 py-3 text-sm font-medium hover:bg-[#0D9488] transition-colors w-full text-center"
          >
            {isSignedIn ? 'Go to Dashboard' : 'Sign In'}
          </Link>
        </div>
      </div>
    </div>
  );
}
