import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Menu, X, Sparkles, LogOut } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';

const navigation = [
  { name: 'Analyzer', href: '/analyze' },
  { name: 'llms.txt', href: '/llms-txt' },
  { name: 'Features', href: '/#features' },
  { name: 'Pricing', href: '/#pricing' },
];

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { data: session, status } = useSession();
  const isLoaded = status !== 'loading';
  const isSignedIn = !!session?.user;

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 w-full z-50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="glass-panel rounded-2xl border border-white/75">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-brand text-white flex items-center justify-center shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="text-[17px] font-semibold tracking-tight text-slate-900">
                RankAI
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-sm font-medium text-slate-700 hover:text-slate-950 transition-colors duration-150"
                >
                  {item.name}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              {isLoaded && (
                <>
                  {isSignedIn ? (
                    <UserMenu
                      name={session.user?.name || session.user?.email || ''}
                      image={session.user?.image}
                    />
                  ) : (
                    <>
                      <Link
                        href="/auth/signin"
                        className="text-sm font-medium text-slate-700 hover:text-slate-950 transition-colors duration-150"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/auth/signup"
                        className="button-primary text-sm px-5 py-2.5"
                      >
                        Get Started
                      </Link>
                    </>
                  )}
                </>
              )}
            </div>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-xl text-slate-700 hover:bg-white/70"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="md:hidden border-t border-slate-200/70 px-3 py-3"
            >
              <div className="flex flex-col gap-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="px-3 py-2 rounded-xl text-slate-700 hover:bg-white/80"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.name}
                  </Link>
                ))}
                {isLoaded && !isSignedIn && (
                  <>
                    <Link href="/auth/signin" className="px-3 py-2 rounded-xl text-slate-700 hover:bg-white/80" onClick={() => setIsMenuOpen(false)}>
                      Sign In
                    </Link>
                    <Link href="/auth/signup" className="button-primary text-sm px-5 py-2.5 mt-2 text-center" onClick={() => setIsMenuOpen(false)}>
                      Get Started
                    </Link>
                  </>
                )}
                {isLoaded && isSignedIn && (
                  <button
                    onClick={() => { signOut({ callbackUrl: '/' }); setIsMenuOpen(false); }}
                    className="px-3 py-2 rounded-xl text-slate-700 hover:bg-white/80 text-left flex items-center gap-2"
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.header>
  );
};

function UserMenu({ name, image }: { name: string; image?: string | null }) {
  const initials = name
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('');

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/analyze"
        className="text-sm font-medium text-slate-700 hover:text-slate-950 transition-colors"
      >
        Dashboard
      </Link>
      {image ? (
        <img src={image} alt={name} className="w-8 h-8 rounded-full border border-slate-200" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-brand text-white flex items-center justify-center text-xs font-semibold">
          {initials}
        </div>
      )}
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

export default Header;
