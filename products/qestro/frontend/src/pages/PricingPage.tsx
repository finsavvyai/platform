import { Check, Sparkles, Zap, Crown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Card, Badge } from '../components/atoms';

const PricingPage = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const getPrice = (monthlyPrice: number) => {
    if (billingCycle === 'annual') {
      return Math.floor(monthlyPrice * 12 * 0.8);
    }
    return monthlyPrice;
  };

  const plans = [
    {
      id: 'free',
      name: 'Free',
      monthlyPrice: 0,
      description: 'Perfect for getting started',
      icon: <Sparkles className="w-6 h-6 text-blue-500" />,
      features: ['5 projects', '100 runs/mo', 'Vibe Test Pilot', 'Community support'],
      popular: false
    },
    {
      id: 'starter',
      name: 'Starter',
      monthlyPrice: 99,
      description: 'Perfect for small teams',
      icon: <Zap className="w-6 h-6 text-orange-500" />,
      features: ['50 projects', '5K runs/mo', 'Self-healing', 'API testing', 'Email support'],
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro',
      monthlyPrice: 499,
      description: 'For scale and mobile testing',
      icon: <Zap className="w-6 h-6 text-yellow-500" />,
      features: ['500 projects', '50K runs/mo', 'All features', 'Mobile testing', 'Priority support', 'Custom integrations'],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      monthlyPrice: null,
      description: 'For large teams',
      icon: <Crown className="w-6 h-6 text-purple-500" />,
      features: ['Unlimited projects', 'Unlimited runs', 'On-premises', 'SLA & compliance', '24/7 support', 'Account manager'],
      popular: false
    }
  ];

  const faqItems = [
    { q: 'Can I change plans anytime?', a: 'Yes! Upgrade or downgrade at any time. Changes take effect immediately.' },
    { q: 'Do you offer refunds?', a: 'We offer a 30-day money-back guarantee. No questions asked.' },
    { q: 'What payment methods?', a: 'All major credit cards, PayPal, and bank transfers via Stripe.' },
    { q: 'Is there a free trial?', a: 'Our Free plan gives you access to core features forever.' },
    { q: 'Can I cancel anytime?', a: 'Yes. Continue accessing your plan until the end of the billing period.' },
    { q: 'Invoice & taxes?', a: 'Stripe handles VAT, GST, and all tax compliance globally.' }
  ];

  const comparisonRows: { feature: string; values: [string, string, string, string] }[] = [
    { feature: 'Projects', values: ['5', '50', '500', 'Unlimited'] },
    { feature: 'Monthly runs', values: ['100', '5K', '50K', 'Unlimited'] },
    { feature: 'Self-healing', values: ['—', '✓', '✓', '✓'] },
    { feature: 'Mobile testing', values: ['—', '—', '✓', '✓'] },
    { feature: 'API testing', values: ['—', '✓', '✓', '✓'] },
    { feature: 'CI/CD integration', values: ['—', '—', '✓', '✓'] },
    { feature: 'Analytics', values: ['Basic', 'Standard', 'Advanced', 'Custom'] },
    { feature: 'Team members', values: ['1', '5', '25', 'Unlimited'] },
    { feature: 'Support', values: ['Community', 'Email', 'Priority', '24/7 Dedicated'] },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white py-20 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Start free. Upgrade as you grow. No credit card required.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                billingCycle === 'annual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Annual <span className="text-green-400 ml-2">Save 20%</span>
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className={`p-8 h-full flex flex-col border-2 transition-all ${
                plan.popular ? 'border-blue-500 bg-slate-800' : 'border-slate-700'
              }`}>
                {plan.popular && <Badge className="mb-4 w-fit">Most Popular</Badge>}
                <div className="flex items-center gap-3 mb-4">
                  {plan.icon}
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                </div>
                <p className="text-slate-400 text-sm mb-6">{plan.description}</p>

                {/* Price */}
                <div className="mb-8">
                  {plan.monthlyPrice !== null ? (
                    <>
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-4xl font-bold">${getPrice(plan.monthlyPrice)}</span>
                        <span className="text-slate-400">{billingCycle === 'annual' ? '/year' : '/month'}</span>
                      </div>
                      {billingCycle === 'annual' && (
                        <p className="text-sm text-green-400">Save ${Math.floor(plan.monthlyPrice * 2.4)}/year</p>
                      )}
                    </>
                  ) : (
                    <div className="text-4xl font-bold">Custom</div>
                  )}
                </div>

                {/* Features */}
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((feature, fidx) => (
                    <li key={fidx} className="text-sm text-slate-300 flex items-center gap-2">
                      <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button variant={plan.popular ? 'primary' : 'outline'} className="w-full">
                  {plan.id === 'free' ? 'Start Free' : plan.id === 'enterprise' ? 'Contact Sales' : 'Get Started'}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* FAQ Section */}
        <section className="max-w-4xl mx-auto mb-20">
          <h2 className="text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {faqItems.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="p-6 border-slate-700 h-full">
                  <h3 className="font-semibold mb-3 text-blue-400">{item.q}</h3>
                  <p className="text-slate-400 text-sm">{item.a}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Feature Comparison Table */}
        <section className="max-w-6xl mx-auto mb-20">
          <h2 className="text-4xl font-bold text-center mb-12">Feature Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-4 px-6 font-semibold">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="text-center py-4 px-6 font-semibold text-blue-400">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-800">
                    <td className="py-4 px-6 text-slate-300">{row.feature}</td>
                    {row.values.map((val, vidx) => (
                      <td key={vidx} className={`text-center py-4 px-6 text-sm ${val === '—' ? 'text-slate-600' : val === '✓' ? 'text-green-400' : 'text-slate-300'}`}>
                        {val === '✓' ? <Check className="w-5 h-5 text-green-400 inline" /> : val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Ship Tests Faster?</h2>
          <p className="text-slate-400 mb-8 text-lg">
            Start automating your testing in minutes, not months.
          </p>
          <Button size="lg" className="gap-2">
            Start Free Now <ChevronRight className="w-4 h-4" />
          </Button>
        </section>
      </div>
    </div>
  );
};

export default PricingPage;
