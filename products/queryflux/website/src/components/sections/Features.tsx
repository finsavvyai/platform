'use client'

import { motion } from 'framer-motion'
import {
  Zap,
  Database,
  Users,
  Shield,
  Code,
  BarChart3,
  MessageSquare,
  Clock,
  GitBranch,
  Cloud,
  Terminal,
  Brain
} from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Query Assistant',
    description: 'Natural language to SQL conversion, query optimization suggestions, and intelligent error explanations.',
    color: 'bg-purple-100 text-purple-600'
  },
  {
    icon: Database,
    title: '35+ Database Support',
    description: 'Connect to PostgreSQL, MySQL, MongoDB, Redis, and 30+ more database types with a single interface.',
    color: 'bg-blue-100 text-blue-600'
  },
  {
    icon: Users,
    title: 'Real-time Collaboration',
    description: 'Work together with your team on queries, share results instantly, and see changes as they happen.',
    color: 'bg-green-100 text-green-600'
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'End-to-end encryption, SSO integration, role-based access control, and comprehensive audit logs.',
    color: 'bg-red-100 text-red-600'
  },
  {
    icon: Code,
    title: 'Code Generation',
    description: 'Generate code in 9+ programming languages and ORMs from your database schemas and queries.',
    color: 'bg-yellow-100 text-yellow-600'
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description: 'Real-time performance monitoring, query execution analysis, and automated alerting.',
    color: 'bg-indigo-100 text-indigo-600'
  },
  {
    icon: MessageSquare,
    title: 'Voice Commands',
    description: 'Execute queries, get insights, and manage databases using natural voice commands.',
    color: 'bg-pink-100 text-pink-600'
  },
  {
    icon: Clock,
    title: 'Query Scheduling',
    description: 'Automate recurring queries, set up data exports, and schedule maintenance tasks.',
    color: 'bg-orange-100 text-orange-600'
  },
  {
    icon: GitBranch,
    title: 'Version Control',
    description: 'Track query changes, maintain history, and collaborate with Git-like version control.',
    color: 'bg-teal-100 text-teal-600'
  }
]

export function Features() {
  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Everything You Need for
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Modern Database Management
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Built by developers, for developers. QueryFlux combines powerful features with an intuitive interface to make database management effortless.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative"
            >
              <div className="relative h-full p-8 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-lg transition-all duration-300">
                {/* Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-gray-50 to-white rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                <div className="relative z-10">
                  {/* Icon */}
                  <div className={`inline-flex p-3 rounded-xl ${feature.color} mb-6`}>
                    <feature.icon className="w-6 h-6" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Advanced Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 text-white"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-3xl font-bold mb-6">
                Advanced Features for Power Users
              </h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Terminal className="w-5 h-5 mt-1 text-blue-400 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">SSH Tunneling & SSL Support</h4>
                    <p className="text-gray-300">Secure connections to remote databases with advanced networking options.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <Cloud className="w-5 h-5 mt-1 text-green-400 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Cloud Database Integration</h4>
                    <p className="text-gray-300">Native support for AWS RDS, Google Cloud SQL, Azure Database, and more.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <GitBranch className="w-5 h-5 mt-1 text-purple-400 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Query Branching & Merging</h4>
                    <p className="text-gray-300">Experiment with queries safely and merge successful versions back to main.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-black/30 rounded-xl p-6 backdrop-blur-sm">
              <div className="aspect-video bg-gray-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Code className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-400">Advanced Query Editor</p>
                  <p className="text-gray-500 text-sm mt-1">With IntelliSense and debugging</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}