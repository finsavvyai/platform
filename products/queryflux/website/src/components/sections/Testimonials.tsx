'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Senior Database Administrator',
      company: 'TechCorp',
      content: 'QueryFlux has revolutionized how our team manages databases. The AI-powered query optimization alone has saved us countless hours of manual tuning.',
      rating: 5,
      avatar: 'SC'
  },
  {
    name: 'Michael Rodriguez',
    role: 'Full-Stack Developer',
      company: 'StartupXYZ',
      content: 'The real-time collaboration features are game-changing. Our team can work on complex queries together, regardless of where they are located.',
      rating: 5,
      avatar: 'MR'
  },
  {
    name: 'Emily Watson',
    role: 'Data Analyst',
      company: 'DataDriven Co',
      content: 'Supporting 35+ database types in one tool is incredible. I can switch between PostgreSQL, MongoDB, and Redis without changing applications.',
      rating: 5,
      avatar: 'EW'
  },
  {
    name: 'David Kim',
    role: 'DevOps Engineer',
      company: 'CloudScale',
      content: 'The enterprise security features and SSO integration made it easy for us to adopt QueryFlux across our entire organization.',
      rating: 5,
      avatar: 'DK'
  },
  {
    name: 'Lisa Anderson',
    role: 'CTO',
      company: 'Innovation Labs',
      content: 'QueryFlux\'s code generation features have accelerated our development process. We can generate API endpoints from database schemas in minutes.',
      rating: 5,
      avatar: 'LA'
  },
  {
    name: 'James Taylor',
    role: 'Backend Developer',
      company: 'GrowthStartup',
      content: 'The voice command feature is surprisingly useful. I can execute queries and get insights while keeping my hands on the keyboard.',
      rating: 5,
      avatar: 'JT'
  }
]

export function Testimonials() {
  return (
    <section className="py-20 bg-gray-50">
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
            Trusted by
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Thousands of Professionals
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Join developers, data analysts, and database administrators who have transformed their workflow with QueryFlux.
          </p>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <div className="h-full p-6 bg-white rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300">
                {/* Rating */}
                <div className="flex items-center space-x-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current text-yellow-400" />
                  ))}
                </div>

                {/* Quote */}
                <div className="relative mb-6">
                  <Quote className="absolute -top-2 -left-2 w-8 h-8 text-gray-200" />
                  <p className="text-gray-700 leading-relaxed pl-6">
                    {testimonial.content}
                  </p>
                </div>

                {/* Author */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-600">{testimonial.role}</div>
                    <div className="text-xs text-gray-500">{testimonial.company}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 bg-white rounded-3xl p-8 shadow-lg border border-gray-100"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">50K+</div>
              <div className="text-gray-600">Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">1M+</div>
              <div className="text-gray-600">Queries Executed Daily</div>
            </div>
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">500+</div>
              <div className="text-gray-600">Enterprise Customers</div>
            </div>
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">4.8/5</div>
              <div className="text-gray-600">User Rating</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}