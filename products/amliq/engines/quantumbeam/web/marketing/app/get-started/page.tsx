'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, ChevronRight, Building, CreditCard, Shield, Users, Zap } from 'lucide-react'

const formSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  company: z.string().min(2, 'Company name must be at least 2 characters'),
  role: z.string().min(2, 'Role must be at least 2 characters'),
  monthlyVolume: z.string().optional(),
  plan: z.enum(['starter', 'professional', 'enterprise'], {
    required_error: 'Please select a plan'
  }),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms and conditions'),
  marketingConsent: z.boolean().optional()
})

type FormData = z.infer<typeof formSchema>

const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$299',
    period: '/month',
    description: 'Perfect for small businesses and startups',
    features: [
      'Up to 10,000 transactions/month',
      'Standard quantum algorithms',
      'Real-time monitoring',
      'Email support',
      'Basic analytics dashboard'
    ],
    highlighted: false
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$999',
    period: '/month',
    description: 'Ideal for growing companies',
    features: [
      'Up to 100,000 transactions/month',
      'Advanced quantum algorithms',
      'Priority processing queue',
      '24/7 phone support',
      'Advanced analytics & reporting',
      'Custom rule engine',
      'API access with webhooks'
    ],
    highlighted: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large-scale operations',
    features: [
      'Unlimited transactions',
      'Custom quantum model development',
      'Dedicated quantum hardware',
      'White-glove onboarding',
      'Custom integrations',
      'SLA guarantees',
      'Dedicated account manager'
    ],
    highlighted: false
  }
]

const useCases = [
  {
    icon: CreditCard,
    title: 'Payment Processing',
    description: 'Real-time fraud detection for online and in-person transactions'
  },
  {
    icon: Shield,
    title: 'Account Protection',
    description: 'Prevent account takeover and identity fraud with quantum security'
  },
  {
    icon: Users,
    title: 'User Verification',
    description: 'Quantum-enhanced identity verification and risk assessment'
  },
  {
    icon: Building,
    title: 'Enterprise Security',
    description: 'Comprehensive fraud prevention for large organizations'
  }
]

export default function GetStartedPage() {
  const [selectedPlan, setSelectedPlan] = useState('professional')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plan: 'professional'
    }
  })

  const watchedPlan = watch('plan')

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsSubmitting(false)
    setIsSubmitted(true)
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center section-padding">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Welcome to QuantumBeam!</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Your quantum-enhanced fraud detection journey begins now. Check your email for next steps.
          </p>
          <div className="bg-muted/50 rounded-lg p-6 text-left">
            <h3 className="font-semibold mb-4">What happens next:</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-quantum-600" />
                <span>Account setup email sent to your registered address</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-quantum-600" />
                <span>API credentials and documentation access</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-quantum-600" />
                <span>Personalized onboarding session scheduled</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-quantum-600" />
                <span>14-day free trial with full feature access</span>
              </li>
            </ul>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-gradient-to-r from-quantum-600 to-brand-purple text-white">
        <div className="container-padding section-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Get Started with QuantumBeam</h1>
            <p className="text-xl opacity-90 mb-8">
              Join leading financial institutions using quantum-enhanced fraud detection to protect millions of transactions.
            </p>
            <div className="flex items-center justify-center space-x-8">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5" />
                <span>14-day free trial</span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Personalized onboarding</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Use Cases */}
      <section className="section-padding bg-muted/50">
        <div className="container-padding">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Trusted by Industry Leaders</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {useCases.map((useCase, index) => (
                <motion.div
                  key={useCase.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="w-12 h-12 bg-gradient-to-r from-quantum-600 to-brand-purple rounded-lg flex items-center justify-center mx-auto mb-4">
                    <useCase.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold mb-2">{useCase.title}</h3>
                  <p className="text-sm text-muted-foreground">{useCase.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="section-padding">
        <div className="container-padding">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Choose Your Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className={`relative rounded-xl border-2 p-8 transition-all duration-300 cursor-pointer ${
                    watchedPlan === plan.id
                      ? 'border-quantum-600 shadow-quantum-lg'
                      : 'border-border hover:border-quantum-400'
                  }`}
                  onClick={() => setValue('plan', plan.id as any)}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-quantum-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <div className="text-3xl font-bold text-quantum-600">
                      {plan.price}
                      <span className="text-lg text-muted-foreground">{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-quantum-600 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`w-full py-3 rounded-lg font-medium transition-all duration-300 ${
                      watchedPlan === plan.id
                        ? 'bg-quantum-600 text-white shadow-quantum'
                        : 'bg-muted text-muted-foreground hover:bg-quantum-600 hover:text-white'
                    }`}
                  >
                    {watchedPlan === plan.id ? 'Selected' : 'Select Plan'}
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sign Up Form */}
      <section className="section-padding bg-muted/50">
        <div className="container-padding">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Create Your Account</h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">First Name *</label>
                  <input
                    {...register('firstName')}
                    className="input-field"
                    placeholder="John"
                  />
                  {errors.firstName && (
                    <p className="text-red-500 text-sm mt-1">{errors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Last Name *</label>
                  <input
                    {...register('lastName')}
                    className="input-field"
                    placeholder="Doe"
                  />
                  {errors.lastName && (
                    <p className="text-red-500 text-sm mt-1">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Work Email *</label>
                <input
                  {...register('email')}
                  type="email"
                  className="input-field"
                  placeholder="john@company.com"
                />
                {errors.email && (
                  <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Company Name *</label>
                <input
                  {...register('company')}
                  className="input-field"
                  placeholder="Acme Corporation"
                />
                {errors.company && (
                  <p className="text-red-500 text-sm mt-1">{errors.company.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Your Role *</label>
                <input
                  {...register('role')}
                  className="input-field"
                  placeholder="Engineering Manager"
                />
                {errors.role && (
                  <p className="text-red-500 text-sm mt-1">{errors.role.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Monthly Transaction Volume</label>
                <select {...register('monthlyVolume')} className="input-field">
                  <option value="">Select volume range</option>
                  <option value="0-1000">0 - 1,000</option>
                  <option value="1000-10000">1,000 - 10,000</option>
                  <option value="10000-100000">10,000 - 100,000</option>
                  <option value="100000+">100,000+</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('agreeToTerms')}
                    className="w-4 h-4 text-quantum-600 rounded border-gray-300 focus:ring-quantum-600"
                  />
                  <span className="text-sm">
                    I agree to the <a href="#" className="text-quantum-600 hover:underline">Terms of Service</a> and{' '}
                    <a href="#" className="text-quantum-600 hover:underline">Privacy Policy</a> *
                  </span>
                </label>
                {errors.agreeToTerms && (
                  <p className="text-red-500 text-sm">{errors.agreeToTerms.message}</p>
                )}

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    {...register('marketingConsent')}
                    className="w-4 h-4 text-quantum-600 rounded border-gray-300 focus:ring-quantum-600"
                  />
                  <span className="text-sm">
                    I'd like to receive product updates and quantum computing insights
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full btn-primary quantum-glow disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating Account...' : 'Start Free Trial'}
                <ChevronRight className="w-5 h-5 ml-2" />
              </button>
            </form>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>Have questions? Contact our sales team at <a href="mailto:sales@quantumbeam.io" className="text-quantum-600 hover:underline">sales@quantumbeam.io</a></p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}