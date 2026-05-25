import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, 
  Smartphone, 
  Globe, 
  Brain, 
  Database, 
  Zap, 
  Code, 
  ArrowRight,
  Clock,
  CheckCircle,
  Rocket,
  Monitor,
  Cpu,
  Terminal
} from 'lucide-react';

export default function ProductLandingPage() {
  const quickFeatures = [
    {
      icon: <Play className="h-8 w-8 text-apple-blue" />,
      title: "Record Tests in Seconds",
      description: "Click record, interact with your app, done. Works with any web or mobile app.",
      time: "2 min setup"
    },
    {
      icon: <Brain className="h-8 w-8 text-apple-purple" />,
      title: "AI Test Generation",
      description: "Type what you want to test in plain English. Get comprehensive test suites instantly.",
      time: "30 sec generation"
    },
    {
      icon: <Database className="h-8 w-8 text-apple-green" />,
      title: "API Testing Made Simple",
      description: "Import your OpenAPI spec or paste a cURL. Start testing APIs immediately.",
      time: "1 min import"
    },
    {
      icon: <Zap className="h-8 w-8 text-apple-orange" />,
      title: "Instant Performance Tests",
      description: "Load test any endpoint with customizable scenarios. See real-time results.",
      time: "Live results"
    }
  ];

  const platforms = [
    {
      icon: <Globe className="h-12 w-12 text-apple-blue" />,
      title: "Web Testing",
      description: "Chrome, Safari, Firefox, Edge",
      features: ["Cross-browser testing", "Responsive design validation", "Accessibility checks"]
    },
    {
      icon: <Smartphone className="h-12 w-12 text-apple-green" />,
      title: "Mobile Testing", 
      description: "iOS & Android devices",
      features: ["Real device cloud", "Simulator testing", "Native app support"]
    },
    {
      icon: <Code className="h-12 w-12 text-apple-purple" />,
      title: "API Testing",
      description: "REST, GraphQL, WebSocket",
      features: ["Auto documentation", "Contract testing", "Mock responses"]
    }
  ];

  const integrations = [
    { name: "GitHub", logo: "GH", color: "bg-gray-800" },
    { name: "Slack", logo: "SL", color: "bg-purple-600" },
    { name: "Jira", logo: "JI", color: "bg-blue-600" },
    { name: "Jenkins", logo: "JE", color: "bg-orange-600" },
    { name: "Docker", logo: "DO", color: "bg-blue-500" },
    { name: "AWS", logo: "AW", color: "bg-orange-500" },
    { name: "Azure", logo: "AZ", color: "bg-blue-600" },
    { name: "GCP", logo: "GC", color: "bg-green-600" }
  ];

  const codeExample = `// AI Generated Test
describe('User Login Flow', () => {
  it('should login with valid credentials', async () => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'user@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });
});`;

  return (
    <div className="relative">
      {/* Hero Section - Product Focused */}
      <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto text-center animate-fade-in">
          <div className="mb-8">
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-apple-green/10 text-apple-green border border-apple-green/20">
              <Rocket className="w-4 h-4 mr-2" />
              Start Testing in 2 Minutes
            </span>
          </div>
          
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 text-gray-900 dark:text-white leading-tight">
            Test Anything.
            <br />
            <span className="bg-gradient-to-r from-apple-blue via-apple-purple to-apple-green bg-clip-text text-transparent">
              Test Everything.
            </span>
          </h1>
          
          <p className="text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
            The fastest way to test web apps, mobile apps, and APIs. 
            Record tests, generate with AI, or write code - whatever works for you.
          </p>
          
          <div className="flex flex-col lg:flex-row gap-6 justify-center items-center">
            <Link 
              to="/signup" 
              className="bg-apple-blue hover:bg-apple-blue-dark text-white px-10 py-5 rounded-2xl font-bold text-xl transition-all duration-200 transform hover:-translate-y-1 hover:shadow-apple-3 inline-flex items-center"
            >
              Start Testing Free
              <ArrowRight className="ml-3 h-6 w-6" />
            </Link>
            <Link 
              to="/demo" 
              className="border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-apple-blue hover:text-apple-blue px-10 py-5 rounded-2xl font-bold text-xl transition-all duration-200"
            >
              Live Demo
            </Link>
          </div>
          
          <div className="mt-16 text-sm text-gray-500 dark:text-gray-400">
            No setup required • Free for 14 days • No credit card needed
          </div>
        </div>
      </section>

      {/* Quick Features */}
      <section className="py-24 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Choose your testing style - we support them all
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-8">
            {quickFeatures.map((feature, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-3xl p-8 hover:shadow-apple-3 transition-all duration-300 transform hover:-translate-y-1">
                <div className="mb-6 flex items-center justify-between">
                  {feature.icon}
                  <span className="text-xs font-semibold text-apple-green bg-apple-green/10 px-2 py-1 rounded-full">
                    {feature.time}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Test Every Platform
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              One tool for web, mobile, and API testing
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-12">
            {platforms.map((platform, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-3xl p-10 shadow-apple-2 hover:shadow-apple-3 transition-all duration-300">
                <div className="text-center mb-8">
                  {platform.icon}
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
                    {platform.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {platform.description}
                  </p>
                </div>
                
                <div className="space-y-3">
                  {platform.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-apple-green mr-3" />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="py-24 bg-white dark:bg-gray-800">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-8">
                AI Writes Your Tests
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                Just describe what you want to test in plain English. Our AI understands 
                your intent and generates comprehensive test suites in seconds.
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center">
                  <Brain className="h-6 w-6 text-apple-purple mr-3" />
                  <span className="text-gray-700 dark:text-gray-300">Natural language input</span>
                </div>
                <div className="flex items-center">
                  <Code className="h-6 w-6 text-apple-blue mr-3" />
                  <span className="text-gray-700 dark:text-gray-300">Multiple test frameworks</span>
                </div>
                <div className="flex items-center">
                  <Zap className="h-6 w-6 text-apple-orange mr-3" />
                  <span className="text-gray-700 dark:text-gray-300">Instant generation</span>
                </div>
              </div>
              
              <Link 
                to="/ai-demo" 
                className="inline-flex items-center text-apple-blue hover:text-apple-blue-dark font-semibold text-lg"
              >
                Try AI Test Generation
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
            
            <div className="relative">
              <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center mb-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="ml-4 text-gray-400 text-sm">test.spec.js</span>
                </div>
                <pre className="text-green-400 text-sm overflow-x-auto">
                  <code>{codeExample}</code>
                </pre>
              </div>
              
              {/* Floating notification */}
              <div className="absolute -bottom-4 -right-4 bg-apple-green text-white px-4 py-2 rounded-lg shadow-lg text-sm">
                ✨ Generated in 3 seconds
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Integrates with Your Stack
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Connect with the tools you already use
            </p>
          </div>
          
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-8">
            {integrations.map((integration, index) => (
              <div key={index} className="text-center group">
                <div className={`w-16 h-16 ${integration.color} rounded-2xl flex items-center justify-center text-white font-bold text-lg mb-3 mx-auto group-hover:scale-110 transition-transform duration-200`}>
                  {integration.logo}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {integration.name}
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link 
              to="/integrations" 
              className="inline-flex items-center text-apple-blue hover:text-apple-blue-dark font-semibold text-lg"
            >
              View All Integrations
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Product CTA */}
      <section className="py-24 bg-gradient-to-r from-apple-purple to-apple-blue">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-5xl font-bold text-white mb-8">
            Start Testing Today
          </h2>
          <p className="text-xl text-purple-100 mb-12 max-w-2xl mx-auto">
            Join thousands of developers who ship better software faster. 
            Get started in 2 minutes - no setup required.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link 
              to="/signup" 
              className="bg-white text-apple-purple px-10 py-5 rounded-2xl font-bold text-xl hover:bg-gray-50 transition-all duration-200 transform hover:-translate-y-1 inline-flex items-center justify-center"
            >
              Start Free Trial
              <ArrowRight className="ml-3 h-6 w-6" />
            </Link>
            <Link 
              to="/docs" 
              className="border-2 border-white text-white hover:bg-white hover:text-apple-purple px-10 py-5 rounded-2xl font-bold text-xl transition-all duration-200"
            >
              View Documentation
            </Link>
          </div>
          
          <div className="mt-12 text-purple-100 text-sm">
            Free 14-day trial • No credit card required • 2-minute setup
          </div>
        </div>
      </section>
    </div>
  );
}