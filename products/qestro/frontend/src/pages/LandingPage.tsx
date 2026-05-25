import { useState } from 'react';
import { ChevronRight, Github, Twitter, Linkedin, Globe, Zap, Shield, Code2 } from 'lucide-react';
import { Button, Card, Badge } from '../components/atoms';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: <Code2 className="w-8 h-8" />,
    title: 'Vibe Test Pilot',
    description: 'Generate tests from URLs and natural language. AI writes your Playwright code.'
  },
  {
    icon: <Zap className="w-8 h-8" />,
    title: 'Self-Healing',
    description: 'Assertions auto-fix when selectors change. Reduce maintenance by 80%.'
  },
  {
    icon: <Globe className="w-8 h-8" />,
    title: 'Cross-Platform',
    description: 'Browser + Mobile + API in one platform. Maestro integration included.'
  },
  {
    icon: <Shield className="w-8 h-8" />,
    title: 'MCP-Native',
    description: 'Claude integration for AI-driven test orchestration and analysis.'
  }
];

const earlyAdopters = [
  { stat: '80%', label: 'Less test maintenance', description: 'Self-healing assertions reduce flaky test fixes' },
  { stat: '10x', label: 'Faster test creation', description: 'AI generates tests from URLs and descriptions' },
  { stat: '3 platforms', label: 'One tool', description: 'Browser, Mobile, and API testing unified' }
];

const LandingPage = () => {
  const navigate = useNavigate();
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  const handleStartFree = () => {
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-400" />
          <span className="font-bold text-xl">Qestro</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-400 hover:text-white transition">
            Pricing
          </button>
          <Button variant="outline" onClick={() => navigate('/login')}>Sign In</Button>
          <Button onClick={handleStartFree}>Start Free</Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 py-20 md:px-12 md:py-32">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <Badge className="mb-4 inline-block">Now in Early Access</Badge>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent leading-tight">
              The Copilot for Testing Vibe Code.
            </h1>

            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              You ship fast with AI. Qestro makes sure nothing breaks. Paste a URL, describe what to test, get production-ready tests across browser, mobile, and API.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Button size="lg" onClick={handleStartFree} className="gap-2">
                Start Free <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline">
                View Demo
              </Button>
            </div>

            {/* Animated gradient background */}
            <div className="absolute inset-0 -z-10 opacity-20">
              <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-blue-500 rounded-full blur-3xl animate-pulse" />
              <div className="absolute top-1/4 right-1/4 w-80 h-80 bg-purple-500 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="px-6 py-20 md:px-12 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">Powerful Features Built-In</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                onMouseEnter={() => setHoveredFeature(idx)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <Card className={`p-6 h-full cursor-pointer transition-all duration-300 ${
                  hoveredFeature === idx ? 'border-blue-400 bg-slate-800' : 'border-slate-700'
                }`}>
                  <div className="text-blue-400 mb-4">{feature.icon}</div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="px-6 py-20 md:px-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
          <p className="text-center text-slate-400 mb-16">No credit card required. Upgrade anytime.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Free', price: '0', period: 'forever', features: ['5 projects', '100 runs/mo', 'Vibe Test Pilot', 'Community support'], cta: 'Start Free' },
              { name: 'Starter', price: '99', period: 'month', features: ['50 projects', '5K runs/mo', 'Self-healing', 'API testing', 'Email support'], cta: 'Get Started', highlight: false },
              { name: 'Pro', price: '499', period: 'month', features: ['500 projects', '50K runs/mo', 'All features', 'Mobile testing', 'Priority support', 'Custom integrations'], cta: 'Get Started', highlight: true },
              { name: 'Enterprise', price: 'Custom', period: 'month', features: ['Unlimited projects', 'Unlimited runs', 'On-premises', 'SLA & compliance', '24/7 support', 'Account manager'], cta: 'Contact Sales', highlight: false }
            ].map((plan, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className={`p-8 h-full flex flex-col border-2 transition-all ${
                  plan.highlight ? 'border-blue-500 bg-slate-800' : 'border-slate-700'
                }`}>
                  {plan.highlight && <Badge className="mb-4 w-fit">Most Popular</Badge>}
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    {plan.period !== 'forever' && <span className="text-slate-400">/{plan.period}</span>}
                  </div>
                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((feature, fidx) => (
                      <li key={fidx} className="text-sm text-slate-300 flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-blue-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button variant={plan.highlight ? 'primary' : 'outline'} className="w-full">
                    {plan.cta}
                  </Button>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Qestro */}
      <section className="px-6 py-20 md:px-12 bg-slate-900/50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-12">Why Teams Choose Qestro</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {earlyAdopters.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="p-6 border-slate-700 text-center">
                  <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                    {item.stat}
                  </p>
                  <p className="text-lg font-semibold text-white mb-2">{item.label}</p>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 md:px-12">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Ship Tests Faster?</h2>
          <p className="text-slate-400 mb-8">Start automating your testing in minutes, not months.</p>
          <Button size="lg" onClick={handleStartFree} className="gap-2">
            Start Free Today <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-12 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-blue-400" />
                <span className="font-bold">Qestro</span>
              </div>
              <p className="text-slate-400 text-sm">AI-powered testing for every platform.</p>
            </div>
            {[
              { title: 'Product', links: [{ label: 'Features', href: '#' }, { label: 'Pricing', href: '#pricing' }, { label: 'Docs', href: '#' }] },
              { title: 'Company', links: [{ label: 'Blog', href: '#' }, { label: 'About', href: '#' }, { label: 'Contact', href: '#' }] },
              { title: 'Legal', links: [{ label: 'Privacy', href: '/privacy' }, { label: 'Terms', href: '/terms' }, { label: 'Security', href: '#' }] }
            ].map((col, idx) => (
              <div key={idx}>
                <h4 className="font-semibold mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link, lidx) => (
                    <li key={lidx}>
                      <a href={link.href} className="text-slate-400 hover:text-white transition text-sm">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-8 flex items-center justify-between">
            <p className="text-slate-500 text-sm">2026 Qestro. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-slate-400 hover:text-white transition">
                <Github className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition">
                <Linkedin className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
