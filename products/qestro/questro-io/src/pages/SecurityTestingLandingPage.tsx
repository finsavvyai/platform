import React from 'react';
import { motion } from 'framer-motion';
import { 
  Shield, 
  Zap, 
  CheckCircle, 
  ArrowRight, 
  AlertTriangle,
  Lock,
  Search,
  Target,
  Brain,
  Globe
} from 'lucide-react';
import { useSEO } from '../hooks/useSEO';

export default function SecurityTestingLandingPage() {
  useSEO({
    title: 'AI Security Testing & Penetration Testing | Intelligent Vulnerability Scanner',
    description: 'Revolutionary AI-powered security testing platform. Automated penetration testing, OWASP Top 10 scanning, intelligent vulnerability detection with voice commands. Ethical security testing for modern applications.',
    keywords: 'AI security testing, penetration testing, vulnerability scanner, OWASP testing, security automation, AI penetration testing, ethical hacking, security scanning, vulnerability assessment',
    canonical: 'https://questro.io/security-testing'
  });

  const securityFeatures = [
    {
      icon: Target,
      title: "OWASP Top 10 Complete Coverage",
      description: "Comprehensive testing for all OWASP Top 10 vulnerabilities with intelligent payload generation"
    },
    {
      icon: Brain,
      title: "AI-Powered Vulnerability Detection",
      description: "Machine learning algorithms identify complex security patterns and zero-day vulnerabilities"
    },
    {
      icon: Zap,
      title: "Real-time Security Scanning",
      description: "Continuous monitoring and instant alerts for new vulnerabilities as they emerge"
    },
    {
      icon: Lock,
      title: "Ethical Boundary Protection",
      description: "Built-in safeguards ensure all testing remains within ethical and legal boundaries"
    }
  ];

  const vulnerabilityTypes = [
    {
      name: "SQL Injection",
      severity: "Critical",
      color: "red",
      description: "AI-generated payloads test for database injection vulnerabilities"
    },
    {
      name: "Cross-Site Scripting (XSS)",
      severity: "High",
      color: "orange",
      description: "Intelligent XSS detection across reflected, stored, and DOM-based vectors"
    },
    {
      name: "Authentication Bypass",
      severity: "Critical",
      color: "red",
      description: "Advanced testing of authentication mechanisms and session management"
    },
    {
      name: "Security Misconfiguration",
      severity: "Medium",
      color: "yellow",
      description: "Automated detection of insecure configurations and default settings"
    },
    {
      name: "Sensitive Data Exposure",
      severity: "High",
      color: "orange",
      description: "Identifies exposed sensitive information and inadequate data protection"
    },
    {
      name: "Broken Access Control",
      severity: "Critical",
      color: "red",
      description: "Tests for privilege escalation and unauthorized access vulnerabilities"
    }
  ];

  const voiceCommands = [
    "Scan my website for SQL injection vulnerabilities",
    "Check the API endpoints for OWASP Top 10 issues",
    "Run a complete security assessment on the login system",
    "Tell me about critical vulnerabilities found today"
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900 text-white py-24">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mb-8"
            >
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-medium">
                <Shield className="w-4 h-4 mr-2" />
                🛡️ AI-Powered Security Testing Platform
              </div>
            </motion.div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
              <span className="block">Intelligent</span>
              <span className="block bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
                Security Testing
              </span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-gray-300 max-w-4xl mx-auto mb-12 leading-relaxed">
              Revolutionary AI-powered penetration testing that identifies vulnerabilities, 
              generates ethical test payloads, and provides actionable security recommendations—all with voice commands.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16"
            >
              <button className="group bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 hover:shadow-2xl">
                Start Security Scan
                <ArrowRight className="inline-block w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="group border-2 border-white/30 hover:border-white/50 px-8 py-4 rounded-xl font-semibold text-lg backdrop-blur-sm hover:bg-white/10 transition-all">
                <Shield className="inline-block w-5 h-5 mr-2" />
                View Security Demo
              </button>
            </motion.div>

            {/* Security Scan Demo */}
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                <div className="flex items-center space-x-4 mb-6">
                  <Shield className="w-8 h-8 text-orange-400" />
                  <div>
                    <h3 className="text-xl font-semibold">AI Security Assessment</h3>
                    <p className="text-orange-200">Real-time vulnerability detection</p>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm">Critical Vulnerabilities</span>
                      <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">3</span>
                    </div>
                    <div className="text-xs text-red-300">SQL Injection, XSS, Auth Bypass</div>
                  </div>
                  
                  <div className="bg-white/10 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm">Security Score</span>
                      <span className="text-yellow-300 font-bold text-lg">6.2/10</span>
                    </div>
                    <div className="text-xs text-yellow-300">Immediate attention required</div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-red-500/20 rounded-lg border border-red-500/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <span className="font-semibold text-red-400">Critical Alert</span>
                  </div>
                  <p className="text-sm text-red-200">
                    SQL injection vulnerability detected in login endpoint. Immediate remediation recommended.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* OWASP Top 10 Coverage */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
              Complete OWASP Top 10 Coverage
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Comprehensive testing for all major vulnerability categories with AI-powered detection
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vulnerabilityTypes.map((vuln, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 text-lg">{vuln.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    vuln.color === 'red' ? 'bg-red-100 text-red-800' :
                    vuln.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {vuln.severity}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">{vuln.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Advanced Security Testing Features
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              AI-powered security testing that adapts to your application and identifies complex vulnerabilities
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {securityFeatures.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2 }}
                className={`flex items-start space-x-4 ${index % 2 === 1 ? 'md:flex-row-reverse md:space-x-reverse md:text-right' : ''}`}
              >
                <div className={`bg-gradient-to-r from-red-500 to-orange-500 p-4 rounded-2xl ${index % 2 === 1 ? 'md:order-2' : ''}`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <div className={`flex-1 ${index % 2 === 1 ? 'md:order-1' : ''}`}>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 text-lg">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Voice Commands for Security */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Voice-Controlled Security Testing
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Control your security testing with natural language commands. 
                Start comprehensive vulnerability scans with just your voice.
              </p>
              
              <div className="space-y-4">
                {voiceCommands.map((command, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 border-l-4 border-red-500">
                    <p className="font-mono text-red-600">"{command}"</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-red-600 to-orange-600 rounded-3xl p-8 text-white">
                <div className="flex items-center space-x-4 mb-6">
                  <Search className="w-8 h-8" />
                  <div>
                    <h3 className="text-xl font-semibold">Vulnerability Scanner</h3>
                    <p className="text-red-200">AI-Powered Detection Engine</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">OWASP Coverage</span>
                      <span className="text-green-300 font-bold">100%</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div className="bg-green-400 h-2 rounded-full w-full"></div>
                    </div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">False Positive Rate</span>
                      <span className="text-blue-300 font-bold">&lt; 2%</span>
                    </div>
                    <div className="w-full bg-white/20 rounded-full h-2">
                      <div className="bg-blue-400 h-2 rounded-full" style={{width: '98%'}}></div>
                    </div>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">Scan Speed</span>
                      <span className="text-yellow-300 font-bold">5x Faster</span>
                    </div>
                    <div className="text-xs text-red-200">Than traditional scanners</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Ethical Framework */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Ethical Security Testing Framework
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Built with strict ethical boundaries and legal compliance at its core
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center"
            >
              <div className="bg-green-100 p-4 rounded-2xl w-fit mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Authorization Required</h3>
              <p className="text-gray-600">
                Domain ownership verification required before any security testing can begin
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <div className="bg-blue-100 p-4 rounded-2xl w-fit mx-auto mb-6">
                <Shield className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Safe Payloads Only</h3>
              <p className="text-gray-600">
                AI generates detection-focused payloads that identify vulnerabilities without causing damage
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="bg-purple-100 p-4 rounded-2xl w-fit mx-auto mb-6">
                <Lock className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Compliance Ready</h3>
              <p className="text-gray-600">
                SOC 2, PCI DSS, and GDPR compliant with full audit logging and reporting
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-red-600 to-orange-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Secure Your Applications Today
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Start comprehensive AI-powered security testing with voice commands. 
              Identify vulnerabilities before attackers do.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <button className="bg-white text-red-600 hover:bg-gray-100 px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 flex items-center justify-center">
                Start Security Scan
                <Shield className="w-5 h-5 ml-2" />
              </button>
              <button className="border-2 border-white hover:bg-white hover:text-red-600 px-8 py-4 rounded-xl font-semibold text-lg transition-all">
                Schedule Security Demo
              </button>
            </div>
            <p className="text-sm mt-6 opacity-75">
              Ethical testing only • Domain verification required • 14-day free trial
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}