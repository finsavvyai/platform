import Link from 'next/link'
import { Search, Book, Code, Rocket, Users, Zap, ArrowRight, Star } from 'lucide-react'

import { Button } from '@mcpoverflow/ui'

export default function DocumentationHome() {
  const quickLinks = [
    {
      title: 'Getting Started',
      description: 'Set up your first AI agent in minutes',
      icon: Rocket,
      href: '/docs/getting-started',
      color: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'API Reference',
      description: 'Complete API documentation and examples',
      icon: Code,
      href: '/docs/api',
      color: 'from-purple-500 to-pink-600'
    },
    {
      title: 'Guides & Tutorials',
      description: 'Step-by-step guides for common tasks',
      icon: Book,
      href: '/docs/guides',
      color: 'from-green-500 to-emerald-600'
    },
    {
      title: 'Examples',
      description: 'Ready-to-use code examples and templates',
      icon: Zap,
      href: '/docs/examples',
      color: 'from-orange-500 to-red-600'
    }
  ]

  const popularTopics = [
    { title: 'Agent Deployment', href: '/docs/guides/deployment' },
    { title: 'API Integration', href: '/docs/guides/api-integration' },
    { title: 'Performance Optimization', href: '/docs/guides/performance' },
    { title: 'Security Best Practices', href: '/docs/guides/security' },
    { title: 'Troubleshooting', href: '/docs/guides/troubleshooting' },
    { title: 'Configuration', href: '/docs/configuration' }
  ]

  const stats = [
    { label: 'API Endpoints', value: '150+' },
    { label: 'Code Examples', value: '200+' },
    { label: 'Guides', value: '50+' },
    { label: 'Contributors', value: '25+' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-purple-900/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10" />
        <div className="container mx-auto px-4 py-16 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center space-x-2 bg-blue-100 dark:bg-blue-900/30 rounded-full px-4 py-2 mb-8">
              <Book className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Comprehensive Documentation
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 dark:from-white dark:via-purple-200 dark:to-white bg-clip-text text-transparent">
              MCPOverflow Documentation
            </h1>

            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Everything you need to build, deploy, and manage intelligent AI agents.
              From getting started guides to advanced API references.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700">
                <Rocket className="mr-2 h-5 w-5" />
                Get Started
              </Button>
              <Button size="lg" variant="outline">
                <Search className="mr-2 h-5 w-5" />
                Search Docs
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl font-bold text-foreground mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Quick Access</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Jump to the most important sections of our documentation
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickLinks.map((link, index) => (
              <Link
                key={index}
                href={link.href}
                className="group block p-6 rounded-xl border bg-card hover:shadow-lg transition-all hover:scale-105"
              >
                <div className={`inline-flex p-3 rounded-lg bg-gradient-to-r ${link.color} mb-4`}>
                  <link.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-2 group-hover:text-purple-600 transition-colors">
                  {link.title}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {link.description}
                </p>
                <div className="flex items-center text-purple-600 font-medium">
                  Learn more <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Topics */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Popular Topics</h2>
              <p className="text-lg text-muted-foreground">
                Frequently accessed documentation sections
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {popularTopics.map((topic, index) => (
                <Link
                  key={index}
                  href={topic.href}
                  className="flex items-center space-x-3 p-4 rounded-lg bg-card hover:bg-accent transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-purple-600" />
                  <span className="font-medium">{topic.title}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex items-center justify-center mb-6">
              <Users className="h-12 w-12 text-purple-600" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Join Our Community</h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Connect with developers, share your experiences, and get help from the MCPOverflow team.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white">
                <Users className="mr-2 h-4 w-4" />
                Join Discord
              </Button>
              <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white">
                <Star className="mr-2 h-4 w-4" />
                GitHub Discussions
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-purple-100 mb-8 max-w-2xl mx-auto">
              Build your first AI agent today and join thousands of developers using MCPOverflow.
            </p>
            <Button size="lg" className="bg-white text-purple-600 hover:bg-purple-50">
              Start Building <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}