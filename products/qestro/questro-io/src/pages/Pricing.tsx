import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Star, Zap, Shield, Users, Infinity } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  popular?: boolean;
  features: PricingFeature[];
  limits: {
    recordings: number | 'unlimited';
    executions: number | 'unlimited';
    teamMembers: number | 'unlimited';
    projects: number | 'unlimited';
    storage: number | 'unlimited';
    support: string;
  };
  cta: string;
  color: string;
}

interface PricingFeature {
  name: string;
  included: boolean;
  limit?: number | string;
}

export default function Pricing() {
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free',
      description: 'Perfect for trying out Questro',
      price: 0,
      currency: 'USD',
      interval: billingInterval,
      features: [
        { name: 'Web & Mobile Recording', included: true, limit: '10/month' },
        { name: 'Test Execution', included: true, limit: '50/month' },
        { name: 'Export Formats', included: true, limit: 'Basic' },
        { name: 'Projects', included: true, limit: '2' },
        { name: 'Team Members', included: true, limit: '1' },
        { name: 'Storage', included: true, limit: '1 GB' },
        { name: 'Community Support', included: true },
        { name: 'Integrations', included: false },
        { name: 'Custom Branding', included: false },
        { name: 'Priority Support', included: false },
        { name: 'SSO', included: false },
      ],
      limits: {
        recordings: 10,
        executions: 50,
        teamMembers: 1,
        projects: 2,
        storage: 1,
        support: 'Community',
      },
      cta: 'Get Started Free',
      color: 'gray',
    },
    {
      id: 'starter',
      name: 'Starter',
      description: 'For small teams getting started',
      price: billingInterval === 'month' ? 29 : 278,
      currency: 'USD',
      interval: billingInterval,
      features: [
        { name: 'Web & Mobile Recording', included: true, limit: '100/month' },
        { name: 'Test Execution', included: true, limit: '500/month' },
        { name: 'All Export Formats', included: true },
        { name: 'Projects', included: true, limit: '10' },
        { name: 'Team Members', included: true, limit: '3' },
        { name: 'Storage', included: true, limit: '10 GB' },
        { name: 'Email Support', included: true },
        { name: 'Basic Integrations', included: true, limit: 'Slack, GitHub' },
        { name: 'Parallel Execution', included: true, limit: '3x' },
        { name: 'Custom Branding', included: false },
        { name: 'SSO', included: false },
      ],
      limits: {
        recordings: 100,
        executions: 500,
        teamMembers: 3,
        projects: 10,
        storage: 10,
        support: 'Email (24h)',
      },
      cta: 'Start 14-Day Trial',
      color: 'blue',
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'For growing teams that need more power',
      price: billingInterval === 'month' ? 99 : 950,
      currency: 'USD',
      interval: billingInterval,
      popular: true,
      features: [
        { name: 'Unlimited Recording', included: true },
        { name: 'Test Execution', included: true, limit: '2,000/month' },
        { name: 'All Export Formats', included: true },
        { name: 'Unlimited Projects', included: true },
        { name: 'Team Members', included: true, limit: '10' },
        { name: 'Storage', included: true, limit: '50 GB' },
        { name: 'Priority Support', included: true, limit: '4h response' },
        { name: 'Advanced Integrations', included: true },
        { name: 'Parallel Execution', included: true, limit: '10x' },
        { name: 'Custom Branding', included: true },
        { name: 'Advanced Analytics', included: true },
      ],
      limits: {
        recordings: 'unlimited',
        executions: 2000,
        teamMembers: 10,
        projects: 'unlimited',
        storage: 50,
        support: 'Priority (4h)',
      },
      cta: 'Start 14-Day Trial',
      color: 'purple',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For large organizations with advanced needs',
      price: billingInterval === 'month' ? 299 : 2870,
      currency: 'USD',
      interval: billingInterval,
      features: [
        { name: 'Unlimited Everything', included: true },
        { name: 'Unlimited Team Members', included: true },
        { name: 'Unlimited Storage', included: true },
        { name: 'Dedicated Support', included: true },
        { name: 'All Integrations', included: true },
        { name: 'Unlimited Parallel Execution', included: true },
        { name: 'Full Custom Branding', included: true },
        { name: 'SSO Integration', included: true },
        { name: 'Audit Logs', included: true },
        { name: 'On-premise Deployment', included: true },
        { name: '99.9% SLA', included: true },
      ],
      limits: {
        recordings: 'unlimited',
        executions: 'unlimited',
        teamMembers: 'unlimited',
        projects: 'unlimited',
        storage: 'unlimited',
        support: 'Dedicated CSM',
      },
      cta: 'Contact Sales',
      color: 'gold',
    },
  ];

  const handleSelectPlan = async (planId: string) => {
    setIsLoading(planId);
    
    try {
      if (planId === 'free') {
        // Redirect to signup
        window.location.href = '/signup';
        return;
      }

      if (planId === 'enterprise') {
        // Redirect to contact sales
        window.location.href = '/contact';
        return;
      }

      // For paid plans, create checkout session
      const response = await fetch('/api/billing/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          planId,
          interval: billingInterval,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { checkoutUrl } = await response.json();
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Failed to select plan:', error);
      toast.error('Failed to proceed with plan selection. Please try again.');
    } finally {
      setIsLoading(null);
    }
  };

  const formatPrice = (price: number, interval: string) => {
    if (price === 0) return 'Free';
    return `$${price}/${interval}`;
  };

  const getColorClasses = (color: string, popular?: boolean) => {
    const colors = {
      gray: 'border-gray-200 bg-white',
      blue: 'border-blue-200 bg-blue-50',
      purple: popular ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-500' : 'border-purple-200 bg-purple-50',
      gold: 'border-yellow-200 bg-yellow-50',
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  const getButtonClasses = (color: string, popular?: boolean) => {
    const colors = {
      gray: 'bg-gray-900 hover:bg-gray-800 text-white',
      blue: 'bg-blue-600 hover:bg-blue-700 text-white',
      purple: 'bg-purple-600 hover:bg-purple-700 text-white',
      gold: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-gray-900 mb-4"
          >
            Choose Your Questro Plan
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-600 max-w-3xl mx-auto mb-8"
          >
            Start free, then scale with powerful features as your testing needs grow.
            All plans include unlimited support and access to our comprehensive documentation.
          </motion.p>

          {/* Billing Toggle */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center mb-8"
          >
            <span className={`mr-3 ${billingInterval === 'month' ? 'text-gray-900' : 'text-gray-500'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingInterval(billingInterval === 'month' ? 'year' : 'month')}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                billingInterval === 'year' ? 'bg-purple-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingInterval === 'year' ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`ml-3 ${billingInterval === 'year' ? 'text-gray-900' : 'text-gray-500'}`}>
              Annual
              <span className="ml-1 text-green-600 font-medium">(Save 20%)</span>
            </span>
          </motion.div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-2xl p-8 shadow-lg ${getColorClasses(plan.color, plan.popular)}`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium flex items-center">
                    <Star className="w-4 h-4 mr-1" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 mb-4">{plan.description}</p>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    {formatPrice(plan.price, plan.interval)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-gray-500 ml-1">/{plan.interval}</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={isLoading === plan.id}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${getButtonClasses(plan.color, plan.popular)}`}
              >
                {isLoading === plan.id ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                    Loading...
                  </div>
                ) : (
                  plan.cta
                )}
              </button>

              <div className="mt-6 space-y-3">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-start">
                    {feature.included ? (
                      <Check className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                    )}
                    <div className={`text-sm ${feature.included ? 'text-gray-900' : 'text-gray-500'}`}>
                      <span className="font-medium">{feature.name}</span>
                      {feature.limit && (
                        <span className="text-gray-600 ml-1">({feature.limit})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Feature Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-2xl shadow-lg p-8 mb-16"
        >
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Compare All Features
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-6 font-medium text-gray-900">Features</th>
                  <th className="text-center py-4 px-6 font-medium text-gray-900">Free</th>
                  <th className="text-center py-4 px-6 font-medium text-gray-900">Starter</th>
                  <th className="text-center py-4 px-6 font-medium text-gray-900">Professional</th>
                  <th className="text-center py-4 px-6 font-medium text-gray-900">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-4 px-6 font-medium text-gray-900">Monthly Recordings</td>
                  <td className="py-4 px-6 text-center">10</td>
                  <td className="py-4 px-6 text-center">100</td>
                  <td className="py-4 px-6 text-center">
                    <Infinity className="w-5 h-5 mx-auto text-purple-600" />
                  </td>
                  <td className="py-4 px-6 text-center">
                    <Infinity className="w-5 h-5 mx-auto text-yellow-600" />
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-gray-900">Monthly Executions</td>
                  <td className="py-4 px-6 text-center">50</td>
                  <td className="py-4 px-6 text-center">500</td>
                  <td className="py-4 px-6 text-center">2,000</td>
                  <td className="py-4 px-6 text-center">
                    <Infinity className="w-5 h-5 mx-auto text-yellow-600" />
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-gray-900">Team Members</td>
                  <td className="py-4 px-6 text-center">1</td>
                  <td className="py-4 px-6 text-center">3</td>
                  <td className="py-4 px-6 text-center">10</td>
                  <td className="py-4 px-6 text-center">
                    <Infinity className="w-5 h-5 mx-auto text-yellow-600" />
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-gray-900">Parallel Execution</td>
                  <td className="py-4 px-6 text-center">1x</td>
                  <td className="py-4 px-6 text-center">3x</td>
                  <td className="py-4 px-6 text-center">10x</td>
                  <td className="py-4 px-6 text-center">
                    <Infinity className="w-5 h-5 mx-auto text-yellow-600" />
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-gray-900">Support</td>
                  <td className="py-4 px-6 text-center">Community</td>
                  <td className="py-4 px-6 text-center">Email (24h)</td>
                  <td className="py-4 px-6 text-center">Priority (4h)</td>
                  <td className="py-4 px-6 text-center">Dedicated CSM</td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-gray-900">Custom Branding</td>
                  <td className="py-4 px-6 text-center">
                    <X className="w-5 h-5 mx-auto text-gray-400" />
                  </td>
                  <td className="py-4 px-6 text-center">
                    <X className="w-5 h-5 mx-auto text-gray-400" />
                  </td>
                  <td className="py-4 px-6 text-center">
                    <Check className="w-5 h-5 mx-auto text-green-500" />
                  </td>
                  <td className="py-4 px-6 text-center">
                    <Check className="w-5 h-5 mx-auto text-green-500" />
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-6 font-medium text-gray-900">SSO Integration</td>
                  <td className="py-4 px-6 text-center">
                    <X className="w-5 h-5 mx-auto text-gray-400" />
                  </td>
                  <td className="py-4 px-6 text-center">
                    <X className="w-5 h-5 mx-auto text-gray-400" />
                  </td>
                  <td className="py-4 px-6 text-center">
                    <X className="w-5 h-5 mx-auto text-gray-400" />
                  </td>
                  <td className="py-4 px-6 text-center">
                    <Check className="w-5 h-5 mx-auto text-green-500" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-lg p-8"
        >
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-8">
            Frequently Asked Questions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I change my plan anytime?
              </h3>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately with prorated billing.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                Yes! All paid plans come with a 14-day free trial. No credit card required to start.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What happens if I exceed my limits?
              </h3>
              <p className="text-gray-600">
                We'll notify you when you approach your limits. You can upgrade your plan or purchase additional usage as needed.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Do you offer enterprise discounts?
              </h3>
              <p className="text-gray-600">
                Yes! We offer volume discounts for large teams and enterprise customers. Contact our sales team for custom pricing.
              </p>
            </div>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="text-center mt-16"
        >
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Transform Your Testing?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of teams already using Questro for reliable, automated testing.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => handleSelectPlan('free')}
              className="bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-lg font-semibold transition-all transform hover:scale-105"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => window.location.href = '/contact'}
              className="border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white px-8 py-4 rounded-lg font-semibold transition-all"
            >
              Contact Sales
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}