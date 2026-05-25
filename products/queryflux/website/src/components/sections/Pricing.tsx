'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Star, Zap, Shield, Crown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'

const plans = [
  {
    name: 'Free',
    description: 'Perfect for individual developers and small projects',
    price: 0,
    yearlyPrice: 0,
    features: [
      'Up to 3 database connections',
      'Basic query editor',
      '1 user account',
      'Community support',
      'Basic analytics',
      '7-day query history'
    ],
    limitations: [
      'No AI features',
      'No collaboration',
      'No advanced security'
    ],
    icon: Star,
    color: 'from-gray-500 to-gray-600',
    popular: false
  },
  {
    name: 'Pro',
    description: 'For professional developers and small teams',
    price: 29,
    yearlyPrice: 290,
    features: [
      'Unlimited database connections',
      'Advanced query editor with IntelliSense',
      'Up to 5 users',
      'AI-powered query optimization',
      'Real-time collaboration',
      'Email priority support',
      'Advanced analytics & monitoring',
      '90-day query history',
      'Query scheduling',
      'Export to multiple formats'
    ],
    limitations: [],
    icon: Zap,
    color: 'from-blue-500 to-purple-600',
    popular: true
  },
  {
    name: 'Enterprise',
    description: 'For large teams and organizations with advanced needs',
    price: 99,
    yearlyPrice: 990,
    features: [
      'Everything in Pro, plus:',
      'Unlimited users',
      'Advanced security features',
      'SSO integration (SAML, OIDC)',
      'Role-based access control',
      'Audit logs & compliance',
      'Dedicated account manager',
      '24/7 phone & email support',
      'Custom integrations',
      'On-premise deployment option',
      'Unlimited query history',
      'Advanced AI features',
      'White-label options'
    ],
    limitations: [],
    icon: Crown,
    color: 'from-purple-600 to-pink-600',
    popular: false
  }
]

export function Pricing() {
  const [isYearly, setIsYearly] = useState(false)

  return (
    <section id="pricing" className="py-20 bg-white">
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
            Simple, Transparent
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
              Pricing Plans
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Choose the perfect plan for your needs. Start free and scale as you grow.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4">
            <span className={`text-sm font-medium ${!isYearly ? 'text-gray-900' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isYearly ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isYearly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${isYearly ? 'text-gray-900' : 'text-gray-500'}`}>
              Yearly
            </span>
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Save 17%
            </span>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative h-full ${
                plan.popular
                  ? 'lg:scale-105 z-10'
                  : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-20">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                    Most Popular
                  </span>
                </div>
              )}

              <div className={`relative h-full p-8 bg-white border-2 rounded-2xl ${
                plan.popular
                  ? 'border-blue-500 shadow-xl'
                  : 'border-gray-200 hover:border-gray-300'
              } transition-all duration-300 hover:shadow-lg`}>
                {/* Header */}
                <div className="text-center mb-8">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-r ${plan.color} text-white mb-4`}>
                    <plan.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <p className="text-gray-600 mb-6">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    {plan.price === 0 ? (
                      <div className="text-4xl font-bold text-gray-900">Free</div>
                    ) : (
                      <div>
                        <div className="text-4xl font-bold text-gray-900">
                          {formatPrice(isYearly ? plan.yearlyPrice / 12 : plan.price)}
                          <span className="text-lg font-normal text-gray-600">/mo</span>
                        </div>
                        {isYearly && (
                          <div className="text-sm text-green-600 mt-2">
                            {formatPrice(plan.yearlyPrice)} billed annually
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* CTA Button */}
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700'
                        : ''
                    }`}
                    variant={plan.popular ? 'primary' : 'outline'}
                    size="lg"
                  >
                    {plan.price === 0 ? 'Get Started Free' : 'Start Free Trial'}
                  </Button>
                </div>

                {/* Features */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 mb-3">What&apos;s included:</h4>
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </div>
                  ))}

                  {plan.limitations.length > 0 && (
                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-3">Limitations:</h4>
                      {plan.limitations.map((limitation, limitIndex) => (
                        <div key={limitIndex} className="flex items-start space-x-3 opacity-60">
                          <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex-shrink-0 mt-0.5"></div>
                          <span className="text-sm text-gray-600">{limitation}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Money Back Guarantee */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center px-4 py-2 bg-green-50 text-green-800 rounded-full text-sm font-medium">
            <Shield className="w-4 h-4 mr-2" />
            30-day money-back guarantee on all paid plans
          </div>
          <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
            Not satisfied? Get a full refund within 30 days, no questions asked.
          </p>
        </motion.div>
      </div>
    </section>
  )
}