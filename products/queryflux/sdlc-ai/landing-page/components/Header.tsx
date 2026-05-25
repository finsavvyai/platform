import { useState } from 'react';
import { motion } from 'framer-motion';
import { Menu, X, Shield, ScanLine } from 'lucide-react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigation = [
    { name: 'Model Coverage', href: '#security' },
    { name: 'Runtime Control Flow', href: '#features' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Trust Signals', href: '#demo' },
  ];

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 w-full bg-[#050911]/90 backdrop-blur-md z-50 border-b border-sky-500/20"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-sdlc-blue/40 to-sdlc-accent/30 border border-sky-400/40">
              <Shield className="h-5 w-5 text-sdlc-light" />
            </div>
            <span className="text-xl font-bold text-white">OpenSyber</span>
            <ScanLine className="h-4 w-4 text-sdlc-blue hidden sm:block" />
          </div>

          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-slate-300 hover:text-white transition-colors duration-200"
              >
                {item.name}
              </a>
            ))}
          </nav>

          <div className="hidden md:block">
            <a
              href="#demo"
              className="button-primary text-sm"
            >
              Start Secure Pilot
            </a>
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-slate-300 hover:text-white p-2"
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-[#070b14] border-t border-sky-500/20"
          >
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-md"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="pt-4 pb-2">
                <a
                  href="#demo"
                  className="button-primary text-sm w-full text-center block"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Start Secure Pilot
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
};

export default Header;
