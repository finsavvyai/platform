import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import { Card } from './Card';
import { Button } from './Button';
import { PricingPlan } from '../types';

const Pricing = () => {
  const plans: PricingPlan[] = [
    {
      name: 'Pilot',
      price: '$2,400',
      description: 'For teams validating secure AI workflows in production-like environments.',
      features: [
        'Up to 2M governed model calls per month',
        'Core PII and PHI redaction pipelines',
        'Audit log export and replay snapshots',
        '2 environments and 5 policy packs',
        'Email support with implementation office hours',
        'SOC2 and GDPR control mapping',
        'Up to 8 users'
      ],
      lemonsqueezyId: 'OPENSYBER_PILOT'
    },
    {
      name: 'Scale',
      price: '$8,900',
      description: 'For growth-stage and enterprise teams shipping AI features to real customers.',
      features: [
        'Up to 25M governed model calls per month',
        'Advanced DLP with custom pattern registries',
        'Prompt injection and jailbreak controls',
        'SAML SSO, role-based controls, tenant isolation',
        'Policy versioning with staged rollouts',
        'SIEM and incident pipeline integrations',
        'Priority support with dedicated security reviews',
        'Up to 30 users'
      ],
      highlighted: true,
      lemonsqueezyId: 'OPENSYBER_SCALE'
    },
    {
      name: 'Command',
      price: 'Custom',
      description: 'For regulated enterprises that need custom governance, volume, and legal controls.',
      features: [
        'Unlimited volume tiers and custom throughput',
        'Dedicated single-tenant deployment options',
        'Advanced regional routing and data residency',
        'Custom compliance mappings and policy engineering',
        'Executive dashboards and board-ready reporting',
        '24/7 response SLA and named technical advisors',
        'Custom procurement and security package support',
        'Unlimited users'
      ],
      lemonsqueezyId: 'OPENSYBER_COMMAND'
    }
  ];

  const handleSubscribe = (planId: string) => {
    console.log(`Subscribing to plan: ${planId}`);
  };

  return (
    <section id="pricing" className="py-20 bg-[#050910]/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Pricing for Teams Shipping Under Scrutiny
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Start with a focused pilot, then scale to enterprise-grade governance without changing your architecture.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative ${plan.highlighted ? 'md:scale-105' : ''}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="flex items-center px-4 py-1 bg-gradient-to-r from-sdlc-blue to-sdlc-accent rounded-full">
                    <Star className="h-4 w-4 text-yellow-200 mr-1" />
                    <span className="text-sm font-semibold text-white">Best for Live Production</span>
                  </div>
                </div>
              )}

              <Card className={`h-full ${plan.highlighted ? 'border-2 border-sdlc-blue/60' : 'border border-slate-700/60'}`}>
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="text-4xl font-bold gradient-text mb-1">
                    {plan.price}
                    {plan.price !== 'Custom' && (
                      <span className="text-lg text-slate-400">/month</span>
                    )}
                  </div>
                  <p className="text-slate-400">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSubscribe(plan.lemonsqueezyId!)}
                  variant={plan.highlighted ? 'primary' : 'secondary'}
                  size="lg"
                  className="w-full"
                >
                  {plan.highlighted ? 'Start 14-Day Pilot' : 'Talk to Sales'}
                </Button>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-slate-400 mb-4">
            Every plan includes the OpenSyber enforcement engine and full event telemetry.
          </p>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-slate-500">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
              SOC 2 Type II controls
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
              GDPR and regional policy packs
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
              HIPAA-ready event governance
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2" />
              Enterprise onboarding support
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;
