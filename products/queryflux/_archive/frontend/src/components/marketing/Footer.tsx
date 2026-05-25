import { Github, Twitter, Linkedin, Mail, Heart, ArrowUp } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function Footer() {
  const { theme } = useTheme();

  const footerLinks = {
    product: [
      { name: 'Features', href: '/#features' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'Download', href: '/download' },
      { name: 'VS Code Extension', href: 'https://marketplace.visualstudio.com/items?itemName=queryflux.queryflux' }
    ],
    company: [
      { name: 'About', href: '/about' },
      { name: 'Blog', href: '/blog' },
      { name: 'Careers', href: '/careers' },
      { name: 'Press', href: '/press' }
    ],
    resources: [
      { name: 'Documentation', href: '/docs' },
      { name: 'API Reference', href: '/docs/api' },
      { name: 'Tutorials', href: '/docs/tutorials' },
      { name: 'Community', href: '/community' }
    ],
    support: [
      { name: 'Help Center', href: '/help' },
      { name: 'Contact', href: '/contact' },
      { name: 'Status', href: 'https://status.queryflux.com' },
      { name: 'Feedback', href: '/feedback' }
    ]
  };

  const socialLinks = [
    { name: 'GitHub', icon: <Github className="w-5 h-5" />, href: 'https://github.com/queryflux/queryflux' },
    { name: 'Twitter', icon: <Twitter className="w-5 h-5" />, href: 'https://twitter.com/queryflux' },
    { name: 'LinkedIn', icon: <Linkedin className="w-5 h-5" />, href: 'https://linkedin.com/company/queryflux' },
    { name: 'Email', icon: <Mail className="w-5 h-5" />, href: 'mailto:hello@queryflux.com' }
  ];

  const legalLinks = [
    { name: 'Privacy Policy', href: '/privacy' },
    { name: 'Terms of Service', href: '/terms' },
    { name: 'Cookie Policy', href: '/cookies' },
    { name: 'GDPR', href: '/gdpr' }
  ];

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer
      className="relative"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Newsletter Section */}
      <div
        className="py-16 border-t"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <h3
              className="text-3xl font-bold mb-4"
              style={{ color: theme.colors.text }}
            >
              Stay Updated
            </h3>
            <p
              className="text-lg mb-8"
              style={{ color: theme.colors.textSecondary }}
            >
              Get the latest updates, tips, and news about QueryFlux delivered to your inbox.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Handle newsletter signup
              }}
              className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
            >
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                style={{
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }}
                required
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-lg font-medium text-white transition-all hover:scale-105"
                style={{ backgroundColor: theme.colors.accent }}
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
            {/* Brand Section */}
            <div className="lg:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">Q</span>
                </div>
                <span
                  className="text-xl font-bold"
                  style={{ color: theme.colors.text }}
                >
                  QueryFlux
                </span>
              </div>
              <p
                className="text-sm mb-6 max-w-xs"
                style={{ color: theme.colors.textSecondary }}
              >
                The future of database management. AI-powered tools for developers who demand excellence.
              </p>

              {/* Social Links */}
              <div className="flex items-center space-x-4">
                {socialLinks.map((social, index) => (
                  <button
                    key={index}
                    onClick={() => window.open(social.href, '_blank')}
                    className="p-2 rounded-lg transition-colors hover:scale-110"
                    style={{
                      backgroundColor: theme.colors.background + '50',
                      color: theme.colors.text
                    }}
                  >
                    {social.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Links Sections */}
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4
                  className="font-semibold mb-4 capitalize"
                  style={{ color: theme.colors.text }}
                >
                  {category}
                </h4>
                <ul className="space-y-2">
                  {links.map((link, index) => (
                    <li key={index}>
                      <button
                        onClick={() => window.location.href = link.href}
                        className="text-sm transition-colors hover:text-purple-500"
                        style={{ color: theme.colors.textSecondary }}
                      >
                        {link.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div
        className="py-6 border-t"
        style={{ borderColor: theme.colors.border }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between">
            {/* Copyright */}
            <div className="flex items-center text-sm mb-4 sm:mb-0">
              <span style={{ color: theme.colors.textSecondary }}>
                © 2025 QueryFlux. Made with
              </span>
              <Heart
                className="w-4 h-4 mx-1 text-red-500 fill-current"
              />
              <span style={{ color: theme.colors.textSecondary }}>
                by the QueryFlux team.
              </span>
            </div>

            {/* Legal Links */}
            <div className="flex items-center space-x-6 text-sm">
              {legalLinks.map((link, index) => (
                <button
                  key={index}
                  onClick={() => window.location.href = link.href}
                  className="transition-colors hover:text-purple-500"
                  style={{ color: theme.colors.textSecondary }}
                >
                  {link.name}
                </button>
              ))}
            </div>

            {/* Back to Top */}
            <button
              onClick={scrollToTop}
              className="p-2 rounded-lg transition-all hover:scale-110"
              style={{
                backgroundColor: theme.colors.background + '50',
                color: theme.colors.text
              }}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
