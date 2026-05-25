import { Check, X, Star, Zap, Shield, Crown, Rocket } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function Pricing() {
  const { theme } = useTheme();

  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for individual developers and small projects',
      price: '$0',
      period: 'forever',
      icon: <Rocket className="w-6 h-6" />,
      color: '#6B7280',
      features: [
        { name: 'Connect up to 3 databases', included: true },
        { name: 'Basic query editor', included: true },
        { name: 'SQL syntax highlighting', included: true },
        { name: 'Query history (100 queries)', included: true },
        { name: 'Export results (CSV, JSON)', included: true },
        { name: 'AI suggestions (20/month)', included: true },
        { name: 'Email support', included: true },
        { name: 'Real-time collaboration', included: false },
        { name: 'Advanced AI features', included: false },
        { name: 'Team management', included: false },
        { name: 'Priority support', included: false },
        { name: 'Custom integrations', included: false }
      ],
      buttonText: 'Get Started',
      buttonStyle: 'secondary'
    },
    {
      name: 'Professional',
      description: 'For professional developers and growing teams',
      price: '$19',
      period: 'per month',
      icon: <Star className="w-6 h-6" />,
      color: '#8B5CF6',
      popular: true,
      features: [
        { name: 'Connect up to 20 databases', included: true },
        { name: 'Advanced query editor', included: true },
        { name: 'AI-powered query optimization', included: true },
        { name: 'Unlimited query history', included: true },
        { name: 'Export results (All formats)', included: true },
        { name: 'AI suggestions (500/month)', included: true },
        { name: 'Natural language to SQL', included: true },
        { name: 'Real-time collaboration (5 users)', included: true },
        { name: 'Code generation (10 languages)', included: true },
        { name: 'Version control integration', included: true },
        { name: 'Priority email support', included: true },
        { name: 'API access', included: true }
      ],
      buttonText: 'Start Free Trial',
      buttonStyle: 'primary'
    },
    {
      name: 'Enterprise',
      description: 'Advanced features for large teams and organizations',
      price: 'Custom',
      period: 'contact us',
      icon: <Crown className="w-6 h-6" />,
      color: '#DC2626',
      features: [
        { name: 'Unlimited database connections', included: true },
        { name: 'Enterprise query editor', included: true },
        { name: 'Advanced AI suite', included: true },
        { name: 'Unlimited query history', included: true },
        { name: 'Custom export formats', included: true },
        { name: 'Unlimited AI suggestions', included: true },
        { name: 'Advanced analytics', included: true },
        { name: 'Unlimited team collaboration', included: true },
        { name: 'Unlimited code generation', included: true },
        { name: 'Advanced security features', included: true },
        { name: 'SSO & RBAC', included: true },
        { name: 'Dedicated support & SLA', included: true },
        { name: 'Custom integrations', included: true },
        { name: 'On-premise deployment', included: true },
        { name: 'Audit logs & compliance', included: true }
      ],
      buttonText: 'Contact Sales',
      buttonStyle: 'primary'
    }
  ];

  const handlePlanSelection = (planName: string) => {
    if (planName === 'Enterprise') {
      window.location.href = 'mailto:sales@queryflux.com?subject=Enterprise Plan Inquiry';
    } else {
      window.location.href = `/signup?plan=${planName.toLowerCase()}`;
    }
  };

  const integrations = [
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite',
    'AWS RDS', 'Google Cloud SQL', 'Azure Database',
    'Docker', 'Kubernetes', 'Git', 'Slack'
  ];

  return (
    <section
      className="py-20 lg:py-32"
      style={{ backgroundColor: theme.colors.background + '50' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2
            className="text-4xl lg:text-5xl font-bold mb-6"
            style={{ color: theme.colors.text }}
          >
            Simple, Transparent
            <span
              className="block bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
            >
              Pricing for Everyone
            </span>
          </h2>
          <p
            className="text-xl max-w-3xl mx-auto leading-relaxed"
            style={{ color: theme.colors.textSecondary }}
          >
            Start free and scale as you grow. No hidden fees, no surprises.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative p-8 rounded-2xl border-2 ${
                plan.popular
                  ? 'border-purple-500 shadow-2xl'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
              style={{
                backgroundColor: theme.colors.background,
                borderColor: plan.popular ? theme.colors.accent : theme.colors.border,
                transform: plan.popular ? 'scale(1.05)' : 'scale(1)',
                zIndex: plan.popular ? 10 : 1
              }}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div
                  className="absolute -top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm font-semibold"
                  style={{ backgroundColor: theme.colors.accent, color: 'white' }}
                >
                  Most Popular
                </div>
              )}

              {/* Plan Header */}
              <div className="text-center mb-8">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{
                    backgroundColor: plan.color + '20',
                    color: plan.color
                  }}
                >
                  {plan.icon}
                </div>
                <h3
                  className="text-2xl font-bold mb-2"
                  style={{ color: theme.colors.text }}
                >
                  {plan.name}
                </h3>
                <p
                  className="text-sm mb-4"
                  style={{ color: theme.colors.textSecondary }}
                >
                  {plan.description}
                </p>
                <div className="flex items-baseline justify-center">
                  <span
                    className="text-5xl font-bold"
                    style={{ color: theme.colors.text }}
                  >
                    {plan.price}
                  </span>
                  {plan.period !== 'forever' && (
                    <span
                      className="text-lg ml-2"
                      style={{ color: theme.colors.textSecondary }}
                    >
                      /{plan.period}
                    </span>
                  )}
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <div key={featureIndex} className="flex items-center">
                    {feature.included ? (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center mr-3"
                        style={{ backgroundColor: '#10B981' }}
                      >
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    ) : (
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center mr-3"
                        style={{ backgroundColor: '#EF4444' }}
                      >
                        <X className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <span
                      className={`text-sm ${feature.included ? '' : 'opacity-50'}`}
                      style={{ color: theme.colors.text }}
                    >
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <button
                onClick={() => handlePlanSelection(plan.name)}
                className={`w-full py-3 px-6 rounded-lg font-semibold transition-all hover:scale-105 ${
                  plan.buttonStyle === 'primary'
                    ? 'text-white'
                    : 'border-2 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
                style={{
                  backgroundColor: plan.buttonStyle === 'primary'
                    ? theme.colors.accent
                    : 'transparent',
                  borderColor: theme.colors.border,
                  color: plan.buttonStyle === 'primary'
                    ? 'white'
                    : theme.colors.text
                }}
              >
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>

        {/* Additional Information */}
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-4"
            style={{
              backgroundColor: theme.colors.accent + '20',
              color: theme.colors.accent
            }}
          >
            <Shield className="w-4 h-4 mr-2" />
            30-day money-back guarantee on all paid plans
          </div>
          <p style={{ color: theme.colors.textSecondary }}>
            No questions asked. Cancel anytime.
          </p>
        </div>

        {/* Supported Integrations */}
        <div className="text-center">
          <h3
            className="text-2xl font-bold mb-8"
            style={{ color: theme.colors.text }}
          >
            Integrates with Your Favorite Tools
          </h3>
          <div className="flex flex-wrap justify-center gap-3">
            {integrations.map((integration, index) => (
              <span
                key={index}
                className="px-4 py-2 rounded-lg text-sm font-medium border"
                style={{
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text
                }}
              >
                {integration}
              </span>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20 text-center">
          <h3
            className="text-2xl font-bold mb-8"
            style={{ color: theme.colors.text }}
          >
            Frequently Asked Questions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              {
                q: 'Can I change or cancel my plan anytime?',
                a: 'Yes, you can upgrade, downgrade, or cancel your subscription at any time. Changes take effect at the next billing cycle.'
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, PayPal, and wire transfers for Enterprise plans.'
              },
              {
                q: 'Is my data secure?',
                a: 'Absolutely. We use enterprise-grade encryption and comply with SOC 2, GDPR, and other security standards.'
              },
              {
                q: 'Do you offer discounts for annual billing?',
                a: 'Yes, save 20% with annual billing on Professional and Enterprise plans.'
              }
            ].map((faq, index) => (
              <div
                key={index}
                className="text-left p-6 rounded-lg border"
                style={{
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border
                }}
              >
                <h4
                  className="font-semibold mb-2"
                  style={{ color: theme.colors.text }}
                >
                  {faq.q}
                </h4>
                <p
                  className="text-sm"
                  style={{ color: theme.colors.textSecondary }}
                >
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
