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
  Terminal,
  Github,
  Command,
  Sparkles,
  Users,
  Star,
  Download
} from 'lucide-react';

export default function LandingPage() {
  const quickFeatures = [
    {
      icon: <Play className="h-8 w-8 text-apple-blue" />,
      title: "Record Tests in Seconds",
      description: "Click record, interact with your app, done. Works with any web or mobile app.",
      time: "2 min setup",
      demo: "Try Demo"
    },
    {
      icon: <Brain className="h-8 w-8 text-apple-purple" />,
      title: "AI Test Generation",
      description: "Type what you want to test in plain English. Get comprehensive test suites instantly.",
      time: "30 sec generation",
      demo: "Try Demo"
    },
    {
      icon: <Database className="h-8 w-8 text-apple-green" />,
      title: "API Testing Made Simple",
      description: "Import your OpenAPI spec or paste a cURL. Start testing APIs immediately.",
      time: "1 min import",
      demo: "Try Demo"
    },
    {
      icon: <Zap className="h-8 w-8 text-apple-orange" />,
      title: "Instant Performance Tests",
      description: "Load test any endpoint with customizable scenarios. See real-time results.",
      time: "Live results",
      demo: "Try Demo"
    }
  ];

  const platforms = [
    {
      icon: <Globe className="h-12 w-12 text-apple-blue" />,
      title: "Web Testing",
      description: "Chrome, Safari, Firefox, Edge",
      features: ["Cross-browser testing", "Responsive design validation", "Accessibility checks"],
      code: "npx questro test --browser chrome"
    },
    {
      icon: <Smartphone className="h-12 w-12 text-apple-green" />,
      title: "Mobile Testing", 
      description: "iOS & Android devices",
      features: ["Real device cloud", "Simulator testing", "Native app support"],
      code: "npx questro test --platform ios"
    },
    {
      icon: <Code className="h-12 w-12 text-apple-purple" />,
      title: "API Testing",
      description: "REST, GraphQL, WebSocket",
      features: ["Auto documentation", "Contract testing", "Mock responses"],
      code: "npx questro api --spec openapi.json"
    }
  ];

  const integrations = [
    { name: "GitHub", logo: "GH", color: "bg-gray-800", description: "CI/CD Integration" },
    { name: "Slack", logo: "SL", color: "bg-purple-600", description: "Real-time alerts" },
    { name: "Jira", logo: "JI", color: "bg-blue-600", description: "Issue tracking" },
    { name: "Jenkins", logo: "JE", color: "bg-orange-600", description: "Build automation" },
    { name: "Docker", logo: "DO", color: "bg-blue-500", description: "Container testing" },
    { name: "AWS", logo: "AW", color: "bg-orange-500", description: "Cloud deployment" },
    { name: "Azure", logo: "AZ", color: "bg-blue-600", description: "DevOps integration" },
    { name: "GCP", logo: "GC", color: "bg-green-600", description: "Cloud testing" }
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

  const developerStats = [
    { value: '50K+', label: 'Developers' },
    { value: '1M+', label: 'Tests Generated' },
    { value: '99.9%', label: 'Uptime' },
    { value: '2min', label: 'Setup Time' }
  ];

  const developerTestimonials = [
    {
      quote: "Questro is a game-changer for our dev team. We went from manual testing to automated AI-generated tests in minutes.",
      author: "Alex Chen",
      role: "Senior Developer",
      company: "TechStartup",
      avatar: "AC",
      github: "alexchen"
    },
    {
      quote: "The API testing is incredible. Just paste a cURL and get a full test suite. Saved us hours of work.",
      author: "Sarah Kim",
      role: "Backend Engineer",
      company: "API Platform",
      avatar: "SK",
      github: "sarahkim"
    },
    {
      quote: "Finally, a testing tool that doesn't require a PhD to use. The AI suggestions are spot-on.",
      author: "Mike Rodriguez",
      role: "Full Stack Dev",
      company: "WebApp Co",
      avatar: "MR",
      github: "mikerod"
    }
  ];

  return (
    <div className="relative">
      {/* Hero Section - Developer Focused */}
      <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-green-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto text-center animate-fade-in">
          <div className="mb-8">
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-apple-green/10 text-apple-green border border-apple-green/20">
              <Rocket className="w-4 h-4 mr-2" />
              Loved by 50K+ Developers
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Testing Made
            <span className="block text-apple-green">Simple</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed">
            The fastest way to create, run, and maintain tests. 
            <span className="font-semibold text-apple-green"> No more testing headaches.</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link 
              to="/signup" 
              className="inline-flex items-center px-8 py-4 bg-apple-green text-white rounded-full font-semibold text-lg hover:bg-apple-green/90 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Building for Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <Link 
              to="/demo" 
              className="inline-flex items-center px-8 py-4 border-2 border-apple-green text-apple-green rounded-full font-semibold text-lg hover:bg-apple-green hover:text-white transition-all duration-200"
            >
              <Play className="w-5 h-5 mr-2" />
              Try Live Demo
            </Link>
          </div>

          {/* Developer Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {developerStats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-apple-green mb-2">{stat.value}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Features Section */}
      <section className="py-20 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Get Started in Minutes
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Powerful testing tools that work the way developers think. No complex setup required.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {quickFeatures.map((feature, index) => (
              <div key={index} className="p-8 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:shadow-lg transition-all duration-200">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {feature.title}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {feature.time}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
                      {feature.description}
                    </p>
                    <button className="text-apple-green hover:text-apple-green/80 font-medium text-sm flex items-center">
                      {feature.demo}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example Section */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Write Tests in Plain English
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Let AI generate comprehensive test suites from your natural language descriptions.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-700 rounded-2xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Terminal className="w-5 h-5 text-apple-green" />
                <span className="font-mono text-sm text-gray-600 dark:text-gray-300">AI Generated Test</span>
              </div>
              <button className="text-apple-green hover:text-apple-green/80 text-sm font-medium">
                Copy Code
              </button>
            </div>
            
            <pre className="bg-gray-900 text-green-400 p-6 rounded-lg overflow-x-auto text-sm">
              <code>{codeExample}</code>
            </pre>
            
            <div className="mt-6 text-center">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Generated from: "Test user login with valid credentials"
              </p>
              <button className="inline-flex items-center px-6 py-3 bg-apple-green text-white rounded-full font-medium hover:bg-apple-green/90 transition-all duration-200">
                <Brain className="w-4 h-4 mr-2" />
                Generate Your Own Test
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms Section */}
      <section className="py-20 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Test Everything
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              From web apps to mobile apps to APIs. One platform for all your testing needs.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {platforms.map((platform, index) => (
              <div key={index} className="p-8 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:shadow-lg transition-all duration-200">
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-4">
                    {platform.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {platform.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {platform.description}
                  </p>
                </div>
                
                <ul className="space-y-2 mb-6">
                  {platform.features.map((feature, idx) => (
                    <li key={idx} className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                      <CheckCircle className="w-4 h-4 text-apple-green mr-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                
                <div className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs">
                  {platform.code}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Works with Your Stack
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Seamlessly integrate with your existing development tools and workflows.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {integrations.map((integration, index) => (
              <div key={index} className="text-center p-6 rounded-xl bg-white dark:bg-gray-700 shadow-sm hover:shadow-md transition-all duration-200">
                <div className={`w-12 h-12 ${integration.color} rounded-full flex items-center justify-center text-white font-bold mx-auto mb-4`}>
                  {integration.logo}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {integration.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {integration.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Developer Testimonials */}
      <section className="py-20 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Loved by Developers
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {developerTestimonials.map((testimonial, index) => (
              <div key={index} className="p-8 rounded-2xl bg-gray-50 dark:bg-gray-800 shadow-lg">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-apple-green rounded-full flex items-center justify-center text-white font-semibold mr-4">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {testimonial.author}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {testimonial.role}, {testimonial.company}
                    </div>
                    <div className="text-xs text-apple-green font-medium flex items-center">
                      <Github className="w-3 h-3 mr-1" />
                      {testimonial.github}
                    </div>
                  </div>
                </div>
                
                <blockquote className="text-gray-600 dark:text-gray-300 italic mb-4">
                  "{testimonial.quote}"
                </blockquote>
                
                <div className="flex text-apple-yellow">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Developer CTA Section */}
      <section className="py-20 px-4 bg-apple-green">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Start Building Better Tests Today
          </h2>
          <p className="text-xl text-green-100 mb-8 max-w-2xl mx-auto">
            Join 50,000+ developers who've made testing simple with Questro. 
            Get started in 2 minutes, no credit card required.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              to="/signup" 
              className="inline-flex items-center px-8 py-4 bg-white text-apple-green rounded-full font-semibold text-lg hover:bg-gray-100 transition-all duration-200 shadow-lg"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <Link 
              to="/docs" 
              className="inline-flex items-center px-8 py-4 border-2 border-white text-white rounded-full font-semibold text-lg hover:bg-white hover:text-apple-green transition-all duration-200"
            >
              <Command className="w-5 h-5 mr-2" />
              View Documentation
            </Link>
          </div>
          
          <div className="mt-8 text-green-100 text-sm">
            <p>✓ Free forever plan</p>
            <p>✓ No credit card required</p>
            <p>✓ 2-minute setup</p>
          </div>
        </div>
      </section>
    </div>
  );
}