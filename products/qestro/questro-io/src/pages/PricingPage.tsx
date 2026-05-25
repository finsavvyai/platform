import React from 'react';
import { Check, Sparkles, Zap, Crown } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const PricingPage = () => {
  const { upgradeSubscription, isAuthenticated } = useAuthStore();

  const handleUpgrade = (variantId: string) => {
    if (!isAuthenticated) {
      window.location.href = '/login?redirect=/pricing';
      return;
    }
    upgradeSubscription(variantId);
  };

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      description: 'Perfect for getting started',
      icon: <Sparkles className="w-6 h-6 text-blue-500" />,
      features: [
        '100 AI test generations',
        '10 web recording sessions', 
        '5 mobile recording sessions',
        'Community support',
        'No credit card required'
      ],
      variantId: null,
      buttonText: 'Current Plan',
      buttonStyle: 'bg-gray-100 text-gray-400 cursor-not-allowed',
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 29,
      description: 'Perfect for small teams',
      icon: <Zap className="w-6 h-6 text-orange-500" />,
      features: [
        '1,000 AI test generations',
        '100 recording sessions',
        '500 API tests',
        'Email support',
        '5 team members',
        'Advanced analytics',
        'Slack integration'
      ],
      variantId: process.env.VITE_LEMONSQUEEZY_VARIANT_ID_PRO,
      buttonText: 'Upgrade to Pro',
      buttonStyle: 'bg-orange-500 hover:bg-orange-600 text-white',
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 99,
      description: 'For large teams and agencies',
      icon: <Crown className="w-6 h-6 text-purple-500" />,
      features: [
        'Unlimited AI test generations',
        'Unlimited recording sessions',
        'Unlimited API tests',
        'Priority support',
        'Unlimited team members',
        'Custom integrations',
        'White-label options',
        'Dedicated account manager'
      ],
      variantId: process.env.VITE_LEMONSQUEEZY_VARIANT_ID_ENTERPRISE,
      buttonText: 'Upgrade to Enterprise',
      buttonStyle: 'bg-purple-500 hover:bg-purple-600 text-white',
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Start free and upgrade as you grow. All plans include our core testing features.
          </p>
          
          {/* Value Proposition */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-4xl mx-auto mb-12">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">
              🎯 Replace $200+/month in testing tools with Questro
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm text-blue-800">
              <div>
                <strong>BrowserStack:</strong> $29/month<br />
                ❌ <span className="line-through">$348/year</span>
              </div>
              <div>
                <strong>TestRail:</strong> $34/user/month<br />
                ❌ <span className="line-through">$408/year per user</span>
              </div>
              <div>
                <strong>Postman Pro:</strong> $12/month<br />
                ❌ <span className="line-through">$144/year</span>
              </div>
            </div>
            <div className="mt-4 text-blue-900 font-semibold">
              ✅ <span className="text-green-600">Questro Pro: $29/month</span> - Save $900+/year
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                plan.popular 
                  ? 'border-orange-500 transform scale-105' 
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              )}

              <div className="p-8">
                {/* Plan Header */}
                <div className="flex items-center mb-4">
                  {plan.icon}
                  <h3 className="text-2xl font-bold text-gray-900 ml-3">
                    {plan.name}
                  </h3>
                </div>

                <p className="text-gray-600 mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-bold text-gray-900">
                      ${plan.price}
                    </span>
                    <span className="text-gray-600 ml-2">
                      {plan.price > 0 ? '/month' : 'forever'}
                    </span>
                  </div>
                  {plan.price > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      Billed monthly • Cancel anytime
                    </p>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <button
                  onClick={() => plan.variantId && handleUpgrade(plan.variantId)}
                  disabled={!plan.variantId}
                  className={`w-full py-3 px-6 rounded-lg font-semibold transition-all duration-300 ${plan.buttonStyle}`}
                >
                  {plan.buttonText}
                </button>

                {plan.price > 0 && (
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Secure payment powered by LemonSqueezy
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Can I change plans anytime?
              </h3>
              <p className="text-gray-600">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the difference.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600">
                We offer a 30-day money-back guarantee. If you're not satisfied, we'll refund your payment, no questions asked.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards, PayPal, and bank transfers through our secure payment processor LemonSqueezy.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                Our Free plan gives you access to core features forever. No trial period needed - just sign up and start testing!
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibrel text-gray-900 mb-3">
                Can I cancel my subscription?
              </h3>
              <p className="text-gray-600">
                Yes, you can cancel anytime from your account dashboard. You'll continue to have access until the end of your billing period.
              </p>
            </div>

            <div className="bg-white rounded-lg p-6 shadow-md">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Do you handle taxes and invoicing?
              </h3>
              <p className="text-gray-600">
                Yes! LemonSqueezy automatically handles VAT, GST, and all tax compliance globally. You'll receive proper tax invoices for all payments.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">
            Ready to revolutionize your testing?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of developers who trust Questro for their testing needs.
          </p>
          <button
            onClick={() => handleUpgrade(plans[1].variantId!)}
            className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors duration-300"
          >
            Start with Pro Plan - $29/month
          </button>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;