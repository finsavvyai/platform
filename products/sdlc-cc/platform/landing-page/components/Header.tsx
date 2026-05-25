import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Menu, X, Shield } from 'lucide-react';
import { useUser, UserButton } from '@clerk/nextjs';

const navigation = [
  { name: 'Features', href: '#features' },
  { name: 'OpenClaw', href: '#openclaw' },
  { name: 'Pricing', href: '#pricing' },
  { name: 'Demo', href: '#demo' },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  let isSignedIn = false;
  let isLoaded = false;

  try {
    const user = useUser();
    isSignedIn = user.isSignedIn || false;
    isLoaded = user.isLoaded || false;
  } catch {
    isLoaded = true;
  }

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 w-full z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="glass-panel rounded-2xl border border-white/75">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <a href="#" className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-xl bg-gradient-brand text-white flex items-center justify-center shadow-sm">
                <Shield className="h-4 w-4" />
              </div>
              <span className="text-[17px] font-semibold tracking-tight text-slate-900">SDLC.ai</span>
            </a>

            <nav className="hidden md:flex items-center gap-8">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-sm font-medium text-slate-700 hover:text-slate-950 transition-colors duration-150 cursor-pointer"
                >
                  {item.name}
                </a>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {isLoaded && (
                <>
                  {isSignedIn ? (
                    <>
                      <Link href="/dashboard" className="text-sm font-medium text-slate-700 hover:text-slate-950 transition-colors duration-150 cursor-pointer">
                        Dashboard
                      </Link>
                      <UserButton afterSignOutUrl="/" />
                    </>
                  ) : (
                    <>
                      <a href="/sign-in" className="text-sm font-medium text-slate-700 hover:text-slate-950 transition-colors duration-150 cursor-pointer">
                        Sign In
                      </a>
                      <a href="/sign-up" className="button-primary text-sm px-5 py-2.5 cursor-pointer">Start Free</a>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-xl text-slate-700 hover:bg-white/70 cursor-pointer"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:hidden border-t border-slate-200/70 px-3 py-3"
            >
              <div className="flex flex-col gap-1">
                {navigation.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    className="px-3 py-2 rounded-xl text-slate-700 hover:bg-white/80 cursor-pointer"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.header>
  );
};

export default Header;
