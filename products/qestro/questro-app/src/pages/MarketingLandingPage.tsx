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
  Target
} from 'lucide-react';

export default function MarketingLandingPage() {
  const stats = [
    { value: '500+', label: 'Enterprise Customers' },
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '10M+', label: 'Tests Executed' },
    { value: '50%', label: 'Faster Time to Market' }
  ];

  const testimonials = [
    {
      quote: "Questro transformed our testing strategy. We reduced our testing cycle from weeks to days.",
      author: "Sarah Chen",
      role: "VP of Engineering",
      company: "TechCorp",
      avatar: "SC"
    },
    {
      quote: "The ROI was immediate. We caught critical bugs before production and saved millions.",
      author: "Michael Rodriguez",
      role: "CTO",
      company: "FinanceFlow",
      avatar: "MR"
    },
    {
      quote: "Best testing platform we've used. The AI-powered generation is game-changing.",
      author: "Emma Thompson",
      role: "QA Director", 
      company: "RetailNext",
      avatar: "ET"
    }
  ];

  const enterpriseFeatures = [
    {
      icon: <Shield className="h-8 w-8 text-apple-blue" />,
      title: "Enterprise Security",
      description: "SOC 2 Type II compliant with enterprise-grade security controls and audit trails."
    },
    {
      icon: <Users className="h-8 w-8 text-apple-purple" />,
      title: "Team Collaboration",
      description: "Advanced team management with role-based permissions and approval workflows."
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-apple-green" />,
      title: "Analytics & Reporting",
      description: "Executive dashboards with custom reports and automated compliance documentation."
    },
    {
      icon: <Globe className="h-8 w-8 text-apple-orange" />,
      title: "Global Scale",
      description: "Multi-region deployment with 99.9% uptime SLA and 24/7 enterprise support."
    }
  ];

  const caseStudies = [
    {
      company: "Fortune 500 Bank",
      industry: "Financial Services",
      result: "Reduced testing time by 70%",
      challenge: "Legacy system testing complexity",
      solution: "AI-powered test generation for COBOL systems"
    },
    {
      company: "Global E-commerce",
      industry: "Retail Technology", 
      result: "Zero critical production bugs",
      challenge: "Mobile app testing across 50+ devices",
      solution: "Automated cross-device testing pipeline"
    },
    {
      company: "Healthcare Platform",
      industry: "Healthcare Technology",
      result: "$2M saved in incident costs",
      challenge: "HIPAA compliance testing",
      solution: "Compliance-first testing framework"
    }
  ];

  return (
    <div className="relative">
      {/* Hero Section - Enterprise Focused */}
      <section className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-900">
        <div className="absolute inset-0 bg-[url('/api/placeholder/1920/1080')] bg-cover bg-center opacity-5"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto text-center animate-fade-in">
          <div className="mb-8">
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-apple-blue/10 text-apple-blue border border-apple-blue/20">
              <Award className="w-4 h-4 mr-2" />
              Trusted by Fortune 500 Companies
            </span>
          </div>
          
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 text-gray-900 dark:text-white leading-tight">
            Transform Your
            <br />
            <span className="bg-gradient-to-r from-apple-blue via-apple-purple to-apple-green bg-clip-text text-transparent">
              Testing Strategy
            </span>
          </h1>
          
          <p className="text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
            Enterprise-grade testing platform that reduces time-to-market by 50% 
            while ensuring zero critical bugs reach production. Trusted by industry leaders.
          </p>
          
          <div className="flex flex-col lg:flex-row gap-6 justify-center items-center">
            <Link 
              to="/enterprise-demo" 
              className="bg-apple-blue hover:bg-apple-blue-dark text-white px-10 py-5 rounded-2xl font-bold text-xl transition-all duration-200 transform hover:-translate-y-1 hover:shadow-apple-3 inline-flex items-center"
            >
              Schedule Enterprise Demo
              <ArrowRight className="ml-3 h-6 w-6" />
            </Link>
            <Link 
              to="/case-studies" 
              className="border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-apple-blue hover:text-apple-blue px-10 py-5 rounded-2xl font-bold text-xl transition-all duration-200"
            >
              View Case Studies
            </Link>
          </div>
          
          <div className="mt-16 text-sm text-gray-500 dark:text-gray-400">
            Join 500+ companies • SOC 2 Compliant • 99.9% Uptime SLA
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-12">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-5xl lg:text-6xl font-bold text-apple-blue mb-3">
                  {stat.value}
                </div>
                <div className="text-lg text-gray-600 dark:text-gray-300">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Features */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Built for Enterprise Scale
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Security, compliance, and scalability features that meet the demands 
              of the world's most regulated industries.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-8">
            {enterpriseFeatures.map((feature, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-apple-2 hover:shadow-apple-3 transition-all duration-300 transform hover:-translate-y-1">
                <div className="mb-6">
                  {feature.icon}
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

      {/* Case Studies Preview */}
      <section className="py-24 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Proven Results Across Industries
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              See how industry leaders achieve breakthrough results with Questro
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {caseStudies.map((study, index) => (
              <div key={index} className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-3xl p-8 hover:shadow-apple-3 transition-all duration-300">
                <div className="mb-6">
                  <div className="text-sm font-medium text-apple-blue mb-2">{study.industry}</div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{study.company}</h3>
                </div>
                
                <div className="mb-6">
                  <div className="text-3xl font-bold text-apple-green mb-2">{study.result}</div>
                  <div className="text-gray-600 dark:text-gray-300">
                    <strong>Challenge:</strong> {study.challenge}
                  </div>
                </div>
                
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  <strong>Solution:</strong> {study.solution}
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link 
              to="/case-studies" 
              className="inline-flex items-center text-apple-blue hover:text-apple-blue-dark font-semibold text-lg"
            >
              View All Case Studies
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
              What Leaders Say
            </h2>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-apple-2">
                <div className="mb-6">
                  <Quote className="h-8 w-8 text-apple-blue mb-4" />
                  <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                </div>
                
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-apple-blue text-white rounded-full flex items-center justify-center font-bold mr-4">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{testimonial.author}</div>
                    <div className="text-gray-600 dark:text-gray-300 text-sm">
                      {testimonial.role}, {testimonial.company}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="py-24 bg-gradient-to-r from-apple-blue to-apple-purple">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h2 className="text-5xl font-bold text-white mb-8">
            Ready to Transform Your Testing?
          </h2>
          <p className="text-xl text-blue-100 mb-12 max-w-2xl mx-auto">
            Join the Fortune 500 companies that trust Questro for mission-critical testing. 
            Get a personalized demo with ROI analysis.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link 
              to="/enterprise-demo" 
              className="bg-white text-apple-blue px-10 py-5 rounded-2xl font-bold text-xl hover:bg-gray-50 transition-all duration-200 transform hover:-translate-y-1 inline-flex items-center justify-center"
            >
              Get Enterprise Demo
              <ArrowRight className="ml-3 h-6 w-6" />
            </Link>
            <Link 
              to="/contact-sales" 
              className="border-2 border-white text-white hover:bg-white hover:text-apple-blue px-10 py-5 rounded-2xl font-bold text-xl transition-all duration-200"
            >
              Contact Sales
            </Link>
          </div>
          
          <div className="mt-12 text-blue-100 text-sm">
            Enterprise-grade security • Custom pricing • Dedicated support
          </div>
        </div>
      </section>
    </div>
  );
}