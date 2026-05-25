import React from 'react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  Users, 
  Shield, 
  Award,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Star,
  Quote,
  Globe,
  Zap,
  Target,
  Building2,
  Scale,
  Headphones,
  FileText
} from 'lucide-react';

export default function LandingPage() {
  const enterpriseStats = [
    { value: '500+', label: 'Enterprise Customers' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '10M+', label: 'Tests Executed' },
    { value: '50%', label: 'Faster Time to Market' }
  ];

  const enterpriseTestimonials = [
    {
      quote: "Questro transformed our testing strategy. We reduced our testing cycle from weeks to days and achieved 99.9% test coverage across our entire enterprise platform.",
      author: "Sarah Chen",
      role: "VP of Engineering",
      company: "TechCorp",
      avatar: "SC",
      industry: "Technology"
    },
    {
      quote: "The ROI was immediate. We caught critical bugs before production and saved millions in potential downtime costs. The enterprise security features gave us confidence to deploy faster.",
      author: "Michael Rodriguez",
      role: "CTO",
      company: "FinanceFlow",
      avatar: "MR",
      industry: "Financial Services"
    },
    {
      quote: "Best testing platform we've used. The AI-powered generation is game-changing, and the compliance features made our audit process seamless.",
      author: "Emma Thompson",
      role: "QA Director", 
      company: "RetailNext",
      avatar: "ET",
      industry: "Retail"
    }
  ];

  const enterpriseFeatures = [
    {
      icon: <Shield className="h-8 w-8 text-apple-blue" />,
      title: "Enterprise Security",
      description: "SOC 2 Type II compliant with enterprise-grade security controls, audit trails, and role-based access management."
    },
    {
      icon: <Users className="h-8 w-8 text-apple-purple" />,
      title: "Team Collaboration",
      description: "Advanced team management with role-based permissions, approval workflows, and enterprise SSO integration."
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-apple-green" />,
      title: "Executive Analytics",
      description: "Executive dashboards with custom reports, automated compliance documentation, and ROI tracking."
    },
    {
      icon: <Globe className="h-8 w-8 text-apple-orange" />,
      title: "Global Scale",
      description: "Multi-region deployment with 99.9% uptime SLA, 24/7 enterprise support, and dedicated account management."
    }
  ];

  const enterpriseCaseStudies = [
    {
      company: "Fortune 500 Bank",
      industry: "Financial Services",
      result: "Reduced testing time by 70%",
      challenge: "Legacy system testing complexity across 50+ applications",
      solution: "AI-powered test generation for COBOL systems with compliance automation",
      metrics: ["$5M annual savings", "99.9% test coverage", "70% faster releases"]
    },
    {
      company: "Global E-commerce Platform",
      industry: "Retail Technology", 
      result: "Zero critical production bugs",
      challenge: "Mobile app testing across 50+ devices and 20+ countries",
      solution: "Automated cross-device testing pipeline with localization support",
      metrics: ["$2M saved in incident costs", "50% faster feature releases", "Global deployment confidence"]
    },
    {
      company: "Healthcare Platform",
      industry: "Healthcare Technology",
      result: "$2M saved in incident costs",
      challenge: "HIPAA compliance testing across patient data systems",
      solution: "Compliance-first testing framework with automated audit trails",
      metrics: ["100% compliance score", "Zero security incidents", "Faster FDA approvals"]
    }
  ];

  const complianceFeatures = [
    {
      icon: <Scale className="h-6 w-6 text-apple-blue" />,
      title: "SOC 2 Type II",
      description: "Certified compliance with automated audit trails"
    },
    {
      icon: <Shield className="h-6 w-6 text-apple-green" />,
      title: "GDPR Ready",
      description: "Built-in data protection and privacy controls"
    },
    {
      icon: <FileText className="h-6 w-6 text-apple-purple" />,
      title: "HIPAA Compliant",
      description: "Healthcare-grade security and compliance"
    },
    {
      icon: <Building2 className="h-6 w-6 text-apple-orange" />,
      title: "ISO 27001",
      description: "International security standard compliance"
    }
  ];

  return (
    <div className="relative">
      {/* Hero Section - Enterprise Focused */}
      <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-gray-50 to-indigo-50 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto text-center animate-fade-in">
          <div className="mb-8">
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-apple-blue/10 text-apple-blue border border-apple-blue/20">
              <Award className="w-4 h-4 mr-2" />
              Trusted by 500+ Enterprise Teams
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
            Enterprise Testing
            <span className="block text-apple-blue">Reimagined</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed">
            Transform your enterprise testing strategy with AI-powered automation, 
            enterprise-grade security, and compliance-first design. 
            <span className="font-semibold text-apple-blue"> Scale with confidence.</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Link 
              to="/demo-request" 
              className="inline-flex items-center px-8 py-4 bg-apple-blue text-white rounded-full font-semibold text-lg hover:bg-apple-blue/90 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Headphones className="w-5 h-5 mr-2" />
              Schedule Enterprise Demo
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <Link 
              to="/contact-sales" 
              className="inline-flex items-center px-8 py-4 border-2 border-apple-blue text-apple-blue rounded-full font-semibold text-lg hover:bg-apple-blue hover:text-white transition-all duration-200"
            >
              Contact Sales Team
            </Link>
          </div>

          {/* Enterprise Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            {enterpriseStats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-apple-blue mb-2">{stat.value}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Features Section */}
      <section className="py-20 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Built for Enterprise Scale
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Enterprise-grade features designed for large teams, complex workflows, and strict compliance requirements.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {enterpriseFeatures.map((feature, index) => (
              <div key={index} className="p-8 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:shadow-lg transition-all duration-200">
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Enterprise Compliance
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Meet the highest security and compliance standards required by enterprise organizations.
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {complianceFeatures.map((feature, index) => (
              <div key={index} className="text-center p-6 rounded-xl bg-white dark:bg-gray-700 shadow-sm">
                <div className="flex justify-center mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Case Studies */}
      <section className="py-20 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Enterprise Success Stories
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              See how leading enterprises are transforming their testing with Questro.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {enterpriseCaseStudies.map((study, index) => (
              <div key={index} className="p-8 rounded-2xl bg-gray-50 dark:bg-gray-800 hover:shadow-lg transition-all duration-200">
                <div className="mb-6">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-apple-blue/10 text-apple-blue mb-3">
                    {study.industry}
                  </span>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {study.company}
                  </h3>
                  <p className="text-2xl font-bold text-apple-blue mb-4">
                    {study.result}
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Challenge</h4>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">{study.challenge}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Solution</h4>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">{study.solution}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Results</h4>
                    <ul className="space-y-1">
                      {study.metrics.map((metric, idx) => (
                        <li key={idx} className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                          <CheckCircle className="w-4 h-4 text-apple-green mr-2 flex-shrink-0" />
                          {metric}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Testimonials */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Trusted by Enterprise Leaders
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {enterpriseTestimonials.map((testimonial, index) => (
              <div key={index} className="p-8 rounded-2xl bg-white dark:bg-gray-700 shadow-lg">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-apple-blue rounded-full flex items-center justify-center text-white font-semibold mr-4">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {testimonial.author}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {testimonial.role}, {testimonial.company}
                    </div>
                    <div className="text-xs text-apple-blue font-medium">
                      {testimonial.industry}
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

      {/* Enterprise CTA Section */}
      <section className="py-20 px-4 bg-apple-blue">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Enterprise Testing?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join 500+ enterprise teams who trust Questro for their mission-critical testing needs. 
            Get a personalized demo and see the ROI in action.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              to="/demo-request" 
              className="inline-flex items-center px-8 py-4 bg-white text-apple-blue rounded-full font-semibold text-lg hover:bg-gray-100 transition-all duration-200 shadow-lg"
            >
              <Headphones className="w-5 h-5 mr-2" />
              Schedule Enterprise Demo
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
            <Link 
              to="/contact-sales" 
              className="inline-flex items-center px-8 py-4 border-2 border-white text-white rounded-full font-semibold text-lg hover:bg-white hover:text-apple-blue transition-all duration-200"
            >
              Contact Sales Team
            </Link>
          </div>
          
          <div className="mt-8 text-blue-100 text-sm">
            <p>✓ Free 30-day enterprise trial</p>
            <p>✓ Dedicated account manager</p>
            <p>✓ 24/7 enterprise support</p>
          </div>
        </div>
      </section>
    </div>
  );
}