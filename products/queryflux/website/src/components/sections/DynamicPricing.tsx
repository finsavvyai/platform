'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Users, Database, Zap, Shield, Crown, CreditCard, Calculator } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  features: string[];
  popular?: boolean;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  teamSize?: { min: number; max: number };
  queries?: number;
  databases?: number;
  aiCredits?: number;
}

const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    description: 'Perfect for personal projects and small teams',
    features: [
      '1 database connection',
      '100 queries per month',
      'Basic AI suggestions',
      'Email support',
      'Community access'
    ],
    icon: <Database className="w-6 h-6" />,
    color: 'text-gray-300',
    bgColor: 'bg-gray-800/50',
    borderColor: 'border-gray-700',
    teamSize: { min: 1, max: 3 },
    queries: 100,
    databases: 1,
    aiCredits: 10
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 29,
    originalPrice: 49,
    description: 'Ideal for growing teams and power users',
    features: [
      '10 database connections',
      'Unlimited queries',
      'Advanced AI optimization',
      'Priority support',
      'Advanced analytics',
      'API access',
      'Custom themes'
    ],
    popular: true,
    icon: <Zap className="w-6 h-6" />,
    color: 'text-purple-300',
    bgColor: 'bg-purple-900/30',
    borderColor: 'border-purple-600',
    teamSize: { min: 4, max: 20 },
    queries: -1,
    databases: 10,
    aiCredits: 100
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    description: 'Complete solution for large organizations',
    features: [
      'Unlimited database connections',
      'Unlimited queries',
      'Custom AI models',
      'Dedicated support',
      'SLA guarantee',
      'Advanced security',
      'Custom integrations',
      'On-premise option'
    ],
    icon: <Crown className="w-6 h-6" />,
    color: 'text-yellow-300',
    bgColor: 'bg-yellow-900/30',
    borderColor: 'border-yellow-600',
    teamSize: { min: 21, max: 1000 },
    queries: -1,
    databases: -1,
    aiCredits: 1000
  }
];

export function DynamicPricing() {
  const [teamSize, setTeamSize] = useState(8);
  const [selectedPlan, setSelectedPlan] = useState('professional');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showCalculator, setShowCalculator] = useState(false);

  const calculateRecommendation = () => {
    if (teamSize <= 3) return 'starter';
    if (teamSize <= 20) return 'professional';
    return 'enterprise';
  };

  const recommendedPlan = calculateRecommendation();

  const calculateSavings = () => {
    const plan = plans.find(p => p.id === selectedPlan);
    if (!plan || billingCycle === 'monthly') return 0;
    return plan.price * 12 * 0.2; // 20% annual discount
  };

  const formatPrice = (price: number) => {
    if (billingCycle === 'yearly') {
      return (price * 12 * 0.8).toFixed(2);
    }
    return price.toFixed(2);
  };

  const calculateROI = () => {
    const plan = plans.find(p => p.id === selectedPlan);
    if (!plan) return 0;

    // Simple ROI calculation based on productivity gains
    const monthlyProductivityGain = teamSize * 500; // $500 per team member per month
    const monthlyCost = billingCycle === 'yearly' ? parseFloat(formatPrice(plan.price)) : plan.price;

    return ((monthlyProductivityGain - monthlyCost) / monthlyCost * 100).toFixed(0);
  };

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 rounded-full border border-blue-400/30 mb-6"
          >
            <CreditCard className="w-5 h-5 text-blue-400" />
            <span className="text-blue-300 font-medium">Smart Pricing Calculator</span>
          </motion.div>

          <h2 className="text-5xl font-bold text-white mb-6">
            Plans That Scale With You
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Choose the perfect plan for your team size and needs. Our smart calculator helps you find the best fit.
          </p>
        </div>

        {/* Team Size Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 mb-12"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Team Size Calculator</h3>
              <p className="text-gray-400">Tell us about your team to get personalized recommendations</p>
            </div>

            <button
              onClick={() => setShowCalculator(!showCalculator)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Calculator className="w-5 h-5" />
              {showCalculator ? 'Hide' : 'Show'} Details
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Team Size
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={teamSize}
                onChange={(e) => setTeamSize(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-gray-400 mt-2">
                <span>1</span>
                <span className="text-white font-bold">{teamSize} members</span>
                <span>100+</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Billing Cycle
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                    billingCycle === 'monthly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('yearly')}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition ${
                    billingCycle === 'yearly'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  Yearly
                  <span className="text-xs bg-green-500 px-2 py-1 rounded ml-2">Save 20%</span>
                </button>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-300 mb-2">
                Recommended Plan
              </div>
              <div className={`px-4 py-3 rounded-lg border ${
                recommendedPlan === 'professional'
                  ? 'bg-purple-900/30 border-purple-600 text-purple-300'
                  : recommendedPlan === 'enterprise'
                  ? 'bg-yellow-900/30 border-yellow-600 text-yellow-300'
                  : 'bg-gray-700 border-gray-600 text-gray-300'
              }`}>
                {plans.find(p => p.id === recommendedPlan)?.name}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showCalculator && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="grid md:grid-cols-4 gap-4 pt-6 border-t border-gray-700">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-400">{teamSize}</div>
                    <div className="text-sm text-gray-400">Team Members</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">
                      ${formatPrice(plans.find(p => p.id === recommendedPlan)?.price || 0)}
                    </div>
                    <div className="text-sm text-gray-400">
                      {billingCycle === 'yearly' ? '/year' : '/month'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-400">
                      {calculateROI()}%
                    </div>
                    <div className="text-sm text-gray-400">Estimated ROI</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-400">
                      {plans.find(p => p.id === recommendedPlan)?.aiCredits || 0}
                    </div>
                    <div className="text-sm text-gray-400">AI Credits</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pricing Plans */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative rounded-2xl p-8 border transition-all hover:scale-105 ${
                plan.popular
                  ? `${plan.bgColor} ${plan.borderColor} ring-4 ring-purple-500/20`
                  : `${plan.bgColor} ${plan.borderColor}`
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="px-4 py-1 bg-purple-600 text-white text-sm font-medium rounded-full">
                    Most Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-6">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${plan.color} bg-white/10 mb-4`}>
                  {plan.icon}
                </div>
                <h3 className={`text-2xl font-bold mb-2 ${plan.color}`}>{plan.name}</h3>
                <p className="text-gray-400 mb-4">{plan.description}</p>

                <div className="mb-4">
                  {plan.originalPrice && (
                    <div className="text-gray-500 line-through text-lg">
                      ${billingCycle === 'yearly'
                        ? (plan.originalPrice * 12).toFixed(2)
                        : plan.originalPrice.toFixed(2)
                      }/{billingCycle === 'yearly' ? 'year' : 'month'}
                    </div>
                  )}
                  <div className="text-4xl font-bold text-white">
                    ${formatPrice(plan.price)}
                    <span className="text-lg text-gray-400">
                      /{billingCycle === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="text-green-400 text-sm mt-2">
                      Save ${calculateSavings().toFixed(2)} per year
                    </div>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setSelectedPlan(plan.id)}
                className={`w-full py-3 px-6 rounded-lg font-medium transition ${
                  plan.popular
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                }`}
              >
                {selectedPlan === plan.id ? 'Selected' : 'Choose Plan'}
              </button>
            </motion.div>
          ))}
        </div>

        {/* ROI Calculator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 text-center"
        >
          <h3 className="text-2xl font-bold text-white mb-6">
            Maximize Your ROI with QueryFlux
          </h3>

          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="text-3xl font-bold text-blue-400 mb-2">
                10x
              </div>
              <div className="text-gray-300">Faster Query Development</div>
              <div className="text-sm text-gray-500 mt-2">
                AI-powered query generation and optimization
              </div>
            </div>

            <div>
              <div className="text-3xl font-bold text-green-400 mb-2">
                85%
              </div>
              <div className="text-gray-300">Time Saved</div>
              <div className="text-sm text-gray-500 mt-2">
                On database management and optimization
              </div>
            </div>

            <div>
              <div className="text-3xl font-bold text-purple-400 mb-2">
                {calculateROI()}%
              </div>
              <div className="text-gray-300">Average ROI</div>
              <div className="text-sm text-gray-500 mt-2">
                Based on {teamSize} team members
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
