import { motion } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { PricingPlan } from '../types';

const plans: PricingPlan[] = [
  {
    name: 'Starter',
    price: 'Free',
    description: 'For indie creators and small blogs getting started with AI SEO.',
    cta: 'Start Free',
    features: [
      '5 pages monitored',
      'Weekly AI visibility report',
      '2 AI agents tracked',
      'Basic content scoring',
      'Community support',
    ],
  },
  {
    name: 'Growth',
    price: '$79',
    period: '/mo',
    description: 'For growing teams that need real-time AI citation tracking.',
    cta: 'Join Waitlist',
    highlighted: true,
    features: [
      '100 pages monitored',
      'Real-time citation alerts',
      'All 4 AI agents tracked',
      'Content optimization engine',
      'Competitor benchmarking',
      'ai.txt management',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For organizations managing AI visibility at scale.',
    cta: 'Contact Sales',
    features: [
      'Unlimited pages',
      'Custom AI agent integrations',
      'White-label dashboard',
      'API access',
      'Dedicated success manager',
      'SSO & team controls',
      'SLA guarantee',
    ],
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-950 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
            Start free. Upgrade when your AI visibility matters.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: index * 0.05 }}
              className={plan.highlighted ? 'md:-translate-y-2' : ''}
            >
              <Card className={`h-full ${plan.highlighted ? 'ring-2 ring-primary/30' : ''}`}>
                {plan.highlighted && (
                  <div className="inline-flex items-center gap-2 rounded-md bg-primary-50 border border-primary-200 px-3 py-1 text-xs font-semibold text-primary mb-4">
                    <Sparkles className="h-3.5 w-3.5" />
                    Most Popular
                  </div>
                )}

                <h3 className="text-2xl font-semibold text-slate-900 mb-1">
                  {plan.name}
                </h3>
                <div className="text-4xl font-bold tracking-tight text-slate-950 mb-2">
                  {plan.price}
                  {plan.period && (
                    <span className="text-lg font-normal text-slate-500">{plan.period}</span>
                  )}
                </div>
                <p className="text-slate-600 mb-6">{plan.description}</p>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  href="#waitlist"
                  variant={plan.highlighted ? 'primary' : 'secondary'}
                  size="lg"
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="text-center text-sm text-slate-600">
          All plans include HTTPS-only scanning, GDPR-compliant data handling,
          and no-training guarantee on your content.
        </div>
      </div>
    </section>
  );
};

export default Pricing;
