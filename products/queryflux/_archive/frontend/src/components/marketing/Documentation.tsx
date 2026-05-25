import { Book, Code, Database, Zap, Users, Settings, Star, ArrowRight } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function Documentation() {
  const { theme } = useTheme();

  const docSections = [
    {
      title: 'Getting Started',
      icon: <Zap className="w-6 h-6" />,
      articles: [
        { title: 'Installation Guide', description: 'Quick setup for Mac, Windows, and VS Code' },
        { title: 'First Connection', description: 'Connect to your first database' },
        { title: 'Basic Queries', description: 'Write and execute your first queries' }
      ]
    },
    {
      title: 'Features',
      icon: <Star className="w-6 h-6" />,
      articles: [
        { title: 'AI Query Assistant', description: 'Natural language to SQL conversion' },
        { title: 'Query Optimization', description: 'Improve query performance' },
        { title: 'Code Generation', description: 'Generate APIs and ORMs' }
      ]
    },
    {
      title: 'API Reference',
      icon: <Code className="w-6 h-6" />,
      articles: [
        { title: 'REST API', description: 'Complete API documentation' },
        { title: 'WebSocket API', description: 'Real-time events and updates' },
        { title: 'Authentication', description: 'OAuth and API key setup' }
      ]
    },
    {
      title: 'Database Guides',
      icon: <Database className="w-6 h-6" />,
      articles: [
        { title: 'PostgreSQL', description: 'Specific features and optimizations' },
        { title: 'MySQL', description: 'MySQL-specific functionality' },
        { title: 'MongoDB', description: 'NoSQL database support' }
      ]
    },
    {
      title: 'Enterprise',
      icon: <Users className="w-6 h-6" />,
      articles: [
        { title: 'Team Management', description: 'User roles and permissions' },
        { title: 'Security', description: 'Encryption and compliance' },
        { title: 'SSO Integration', description: 'Enterprise authentication' }
      ]
    },
    {
      title: 'Advanced',
      icon: <Settings className="w-6 h-6" />,
      articles: [
        { title: 'Custom Integrations', description: 'Build your own integrations' },
        { title: 'Performance Tuning', description: 'Optimize for large datasets' },
        { title: 'Troubleshooting', description: 'Common issues and solutions' }
      ]
    }
  ];

  const quickLinks = [
    { title: 'Installation', href: '/docs/installation' },
    { title: 'Quick Start', href: '/docs/quick-start' },
    { title: 'API Reference', href: '/docs/api' },
    { title: 'Examples', href: '/docs/examples' },
    { title: 'Troubleshooting', href: '/docs/troubleshooting' },
    { title: 'Changelog', href: '/docs/changelog' }
  ];

  return (
    <section
      className="py-20 lg:py-32"
      style={{ backgroundColor: theme.colors.background + '50' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2
            className="text-4xl lg:text-5xl font-bold mb-6"
            style={{ color: theme.colors.text }}
          >
            Everything You Need to
            <span
              className="block bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
            >
              Get Started Quickly
            </span>
          </h2>
          <p
            className="text-xl max-w-3xl mx-auto leading-relaxed"
            style={{ color: theme.colors.textSecondary }}
          >
            Comprehensive documentation, examples, and guides to help you make the most of QueryFlux.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {quickLinks.map((link, index) => (
            <button
              key={index}
              onClick={() => window.location.href = link.href}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:scale-105"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }}
            >
              {link.title}
            </button>
          ))}
        </div>

        {/* Documentation Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {docSections.map((section, index) => (
            <div
              key={index}
              className="p-6 rounded-2xl border"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border
              }}
            >
              {/* Section Header */}
              <div className="flex items-center mb-6">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mr-4"
                  style={{
                    backgroundColor: theme.colors.accent + '20',
                    color: theme.colors.accent
                  }}
                >
                  {section.icon}
                </div>
                <h3
                  className="text-xl font-bold"
                  style={{ color: theme.colors.text }}
                >
                  {section.title}
                </h3>
              </div>

              {/* Articles List */}
              <div className="space-y-4">
                {section.articles.map((article, articleIndex) => (
                  <button
                    key={articleIndex}
                    onClick={() => window.location.href = `/docs/${section.title.toLowerCase()}/${article.title.toLowerCase().replace(/\s+/g, '-')}`}
                    className="w-full text-left p-4 rounded-lg border transition-all hover:scale-102 hover:border-purple-300"
                    style={{
                      backgroundColor: theme.colors.background + '50',
                      borderColor: theme.colors.border
                    }}
                  >
                    <h4
                      className="font-semibold mb-1 flex items-center justify-between"
                      style={{ color: theme.colors.text }}
                    >
                      {article.title}
                      <ArrowRight className="w-4 h-4 opacity-50" />
                    </h4>
                    <p
                      className="text-sm"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      {article.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Additional Resources */}
        <div className="text-center">
          <div
            className="inline-flex flex-col sm:flex-row items-center gap-8 p-8 rounded-2xl"
            style={{
              background: `linear-gradient(135deg, ${theme.colors.accent}20, ${theme.colors.accent}10)`,
              border: `1px solid ${theme.colors.accent}30`
            }}
          >
            <div className="flex-1">
              <h3
                className="text-2xl font-bold mb-2"
                style={{ color: theme.colors.text }}
              >
                Need Help?
              </h3>
              <p
                className="text-lg mb-4"
                style={{ color: theme.colors.textSecondary }}
              >
                Our community and support team are here to help you succeed.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => window.location.href = 'https://github.com/queryflux/queryflux/discussions'}
                  className="px-4 py-2 rounded-lg font-medium border"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text
                  }}
                >
                  GitHub Discussions
                </button>
                <button
                  onClick={() => window.location.href = 'https://discord.gg/queryflux'}
                  className="px-4 py-2 rounded-lg font-medium border"
                  style={{
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    color: theme.colors.text
                  }}
                >
                  Discord Community
                </button>
                <button
                  onClick={() => window.location.href = 'mailto:support@queryflux.com'}
                  className="px-4 py-2 rounded-lg font-medium text-white"
                  style={{ backgroundColor: theme.colors.accent }}
                >
                  Email Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
