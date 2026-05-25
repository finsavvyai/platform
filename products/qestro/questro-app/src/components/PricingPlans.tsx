import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  ArrowRight, 
  Zap, 
  Star, 
  Crown,
  Mic,
  Shield,
  Brain,
  BarChart3,
  Loader2
} from 'lucide-react';
import { trackSubscription } from '../utils/analytics';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  variantId: string | null;
  recommended?: boolean;
  icon?: React.ComponentType<any>;
  gradient?: string;
}

interface PricingPlansProps {
  userId?: string;
  userEmail?: string;
  currentPlan?: string;
  onPlanSelect?: (planId: string) => void;
}

export default function PricingPlans({ 
  userId, 
  userEmail, 
  currentPlan = 'free',
  onPlanSelect 
}: PricingPlansProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');

  // Default plans structure (fallback if API fails)
  const defaultPlans: Plan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      currency: 'USD',
      interval: 'month',
      features: [
        '10 voice commands/month',
        '5 AI test generations/month',
        '2 security scans/month', 
        'Basic performance testing (10 users)',
        'Community support',
        'Mobile & web testing'
      ],
      variantId: null,
      icon: Star,
      gradient: 'from-gray-500 to-gray-600'
    },
    {
      id: 'starter',
      name: 'Starter',
      price: 29,
      currency: 'USD', 
      interval: 'month',
      features: [
        '100 voice commands/month',
        '50 AI test generations/month',
        '10 security scans/month',
        'Performance testing (100 users)',
        'Email support',
        'Advanced test analytics',
        'API integrations',
        'GitHub integration'
      ],
      variantId: null,
      icon: Zap,
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'professional',
      name: 'Professional', 
      price: 99,
      currency: 'USD',
      interval: 'month',
      features: [
        'Unlimited voice commands',
        'Unlimited AI test generation',
        'Unlimited security scans',
        'Performance testing (1000 users)',
        'Priority support',
        'Voice-controlled security testing',
        'Advanced performance analytics',
        'Multi-region testing',
        'Custom AI models',
        'Team collaboration'
      ],
      variantId: null,
      recommended: true,
      icon: Crown,
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 299,
      currency: 'USD',
      interval: 'month',
      features: [
        'Everything in Professional',
        'Performance testing (10,000+ users)',
        'Dedicated support',
        'Custom integrations',
        'On-premises deployment',
        'Advanced security compliance',
        'Custom voice models',
        'White-label options',
        'SLA guarantees',
        'Custom training'
      ],
      variantId: null,
      icon: Brain,
      gradient: 'from-orange-500 to-red-500'
    }
  ];

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subscriptions/plans');
      
      if (response.ok) {
        const data = await response.json();
        // Merge with default plans and add metadata
        const enhancedPlans = data.plans.map((plan: Plan) => {
          const defaultPlan = defaultPlans.find(p => p.id === plan.id);
          return {
            ...plan,
            ...defaultPlan, // Use default metadata (icon, gradient, etc.)
            features: plan.features.length > 0 ? plan.features : defaultPlan?.features || []
          };
        });
        setPlans(enhancedPlans);
      } else {
        // Fallback to default plans
        setPlans(defaultPlans);
      }
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      setPlans(defaultPlans);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = async (planId: string) => {
    if (!userId || !userEmail) {
      // Redirect to login if not authenticated
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    if (planId === 'free') {
      // Handle free plan directly
      if (onPlanSelect) {
        onPlanSelect(planId);
      }
      return;
    }

    if (planId === currentPlan) {
      return; // Already on this plan
    }

    try {
      setCheckoutLoading(planId);
      setError(null);

      // Create checkout session
      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ planId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout');
      }

      const { checkoutUrl } = await response.json();

      // Track analytics
      const plan = plans.find(p => p.id === planId);
      trackSubscription('subscribe', planId, plan?.price || 0, 'USD', currentPlan);

      // Redirect to LemonSqueezy checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Checkout failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to start checkout');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getButtonText = (planId: string) => {
    if (planId === currentPlan) {
      return 'Current Plan';
    }
    if (planId === 'free') {
      return 'Get Started Free';
    }
    return 'Subscribe Now';
  };

  const getButtonDisabled = (planId: string) => {
    return planId === currentPlan || checkoutLoading === planId;
  };

  const filteredPlans = plans.filter(plan => plan.interval === billingInterval);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading pricing plans...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Billing Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setBillingInterval('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              billingInterval === 'month'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingInterval('year')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              billingInterval === 'year'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Annual
            <span className="ml-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
        {filteredPlans.map((plan, index) => {
          const Icon = plan.icon || Star;
          const isRecommended = plan.recommended;
          const isCurrent = plan.id === currentPlan;
          const isLoading = checkoutLoading === plan.id;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-white rounded-2xl shadow-lg p-8 ${
                isRecommended ? 'ring-2 ring-purple-500 scale-105' : ''
              } ${isCurrent ? 'ring-2 ring-green-500' : ''}`}
            >
              {isRecommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-purple-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-green-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <div className={`bg-gradient-to-r ${plan.gradient} p-3 rounded-xl w-fit mx-auto mb-4`}>
                  <Icon className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                
                <div className="mb-4">
                  <span className="text-4xl font-bold text-gray-900">
                    ${plan.price}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-gray-600">/{plan.interval}</span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start space-x-3">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handlePlanSelect(plan.id)}
                disabled={getButtonDisabled(plan.id)}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center ${
                  isCurrent
                    ? 'bg-green-100 text-green-800 cursor-default'
                    : isRecommended
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 transform hover:scale-105'
                    : 'bg-gray-900 text-white hover:bg-gray-800 transform hover:scale-105'
                } ${getButtonDisabled(plan.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    {getButtonText(plan.id)}
                    {!isCurrent && <ArrowRight className="w-4 h-4 ml-2" />}
                  </>
                )}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Feature Comparison */}
      <div className="mt-16">
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
          Platform Capabilities by Plan
        </h3>
        
        <div className="grid md:grid-cols-4 gap-8">
          <div className="text-center">
            <Mic className="w-12 h-12 text-purple-500 mx-auto mb-4" />
            <h4 className="font-semibold text-gray-900 mb-2">Voice Testing</h4>
            <p className="text-gray-600 text-sm">
              Natural language test creation and execution with voice commands
            </p>
          </div>
          
          <div className="text-center">
            <Brain className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h4 className="font-semibold text-gray-900 mb-2">AI Generation</h4>
            <p className="text-gray-600 text-sm">
              Intelligent test generation from code analysis and requirements
            </p>
          </div>
          
          <div className="text-center">
            <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h4 className="font-semibold text-gray-900 mb-2">Security Testing</h4>
            <p className="text-gray-600 text-sm">
              AI-powered penetration testing and vulnerability scanning
            </p>
          </div>
          
          <div className="text-center">
            <BarChart3 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h4 className="font-semibold text-gray-900 mb-2">Performance</h4>
            <p className="text-gray-600 text-sm">
              Scalable load testing with intelligent scenario generation
            </p>
          </div>
        </div>
      </div>

      {/* FAQ or Contact */}
      <div className="mt-16 text-center">
        <p className="text-gray-600 mb-4">
          Need a custom plan or have questions?
        </p>
        <a
          href="mailto:info@finsavvyai.com"
          className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
        >
          Contact our sales team
          <ArrowRight className="w-4 h-4 ml-1" />
        </a>
      </div>
    </div>
  );
}