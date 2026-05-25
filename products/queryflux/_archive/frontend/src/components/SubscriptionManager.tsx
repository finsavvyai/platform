import { useState, useEffect } from 'react';
import { Crown, Check, X, Zap, Star } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

interface SubscriptionManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Subscription {
  id: string;
  status: string;
  plan_name: string;
  billing_cycle?: string;
  price: number;
  currency: string;
  trial_ends_at?: string;
  renews_at?: string;
}

const PLANS = [
  {
    name: 'Free',
    price: 0,
    billing: 'forever',
    features: [
      '3 database connections',
      'Basic query editor',
      'Query history (50 queries)',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: 19,
    billing: 'monthly',
    variantId: 'pro-monthly',
    features: [
      'Unlimited connections',
      'Multi-tab editor',
      'Full query history',
      'AI query assistant',
      'Schema visualizer',
      'Priority support',
      'Custom themes',
      'All extensions',
    ],
    popular: true,
  },
  {
    name: 'Team',
    price: 49,
    billing: 'monthly',
    variantId: 'team-monthly',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Shared connections',
      'Role-based access',
      'Audit logs',
      'SSO integration',
      'Dedicated support',
      'Custom deployment',
    ],
  },
];

export function SubscriptionManager({ isOpen, onClose }: SubscriptionManagerProps) {
  const { theme } = useTheme();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSubscription();
    }
  }, [isOpen]);

  const loadSubscription = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setSubscription(data);
    }
    setIsLoading(false);
  };

  const handleSubscribe = async (variantId: string, planName: string, price: number) => {
    alert(`LemonSqueezy integration: Subscribe to ${planName} for $${price}/month\n\nVariant ID: ${variantId}\n\nIn production, this would:\n1. Create a LemonSqueezy checkout session\n2. Redirect to payment page\n3. Handle webhook for subscription activation`);
  };

  const handleManage = () => {
    alert('This would redirect to LemonSqueezy customer portal to manage subscription');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!isOpen) return null;

  const isActive = subscription && ['active', 'trial'].includes(subscription.status);
  const isTrial = subscription?.status === 'trial';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-6xl glass-card rounded-3xl shadow-2xl overflow-hidden" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                Subscription Plans
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                Choose the plan that works for you
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full glass-morphism hover-3d transition-all"
          >
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="p-8 max-h-[80vh] overflow-y-auto">
          {subscription && (
            <div className="mb-8 p-4 rounded-xl glass-card border" style={{ borderColor: theme.colors.accent }}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
                    Current Plan: {subscription.plan_name}
                    {isTrial && (
                      <span className="ml-2 px-2 py-0.5 rounded text-xs font-semibold" style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}>
                        Trial
                      </span>
                    )}
                  </h3>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    {isTrial && subscription.trial_ends_at && `Trial ends ${formatDate(subscription.trial_ends_at)}`}
                    {!isTrial && subscription.renews_at && `Renews ${formatDate(subscription.renews_at)}`}
                  </p>
                </div>
                {isActive && subscription.plan_name !== 'Free' && (
                  <button
                    onClick={handleManage}
                    className="px-4 py-2 rounded-lg glass-morphism font-medium"
                    style={{ color: theme.colors.text }}
                  >
                    Manage Subscription
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-6">
            {PLANS.map((plan) => {
              const isCurrentPlan = subscription?.plan_name === plan.name;

              return (
                <div
                  key={plan.name}
                  className={`p-6 rounded-2xl glass-card border-2 transition-all ${
                    plan.popular ? 'scale-105 shadow-2xl' : ''
                  }`}
                  style={{
                    borderColor: plan.popular ? theme.colors.accent : theme.colors.border,
                    backgroundColor: plan.popular ? theme.colors.accent + '10' : 'transparent',
                  }}
                >
                  {plan.popular && (
                    <div className="flex items-center justify-center gap-1 mb-4 px-3 py-1 rounded-full text-xs font-semibold mx-auto w-fit" style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}>
                      <Star className="w-3 h-3 fill-current" />
                      Most Popular
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold mb-2" style={{ color: theme.colors.text }}>
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline justify-center gap-1 mb-1">
                      <span className="text-4xl font-bold" style={{ color: theme.colors.text }}>
                        ${plan.price}
                      </span>
                      <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                        /{plan.billing}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: theme.colors.accent }} />
                        <span style={{ color: theme.colors.text }}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <button
                      disabled
                      className="w-full px-4 py-3 rounded-lg font-semibold opacity-50"
                      style={{ backgroundColor: theme.colors.border, color: theme.colors.text }}
                    >
                      Current Plan
                    </button>
                  ) : plan.variantId ? (
                    <button
                      onClick={() => handleSubscribe(plan.variantId!, plan.name, plan.price)}
                      className="w-full px-4 py-3 text-white rounded-lg font-semibold transition-all hover:scale-105"
                      style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                    >
                      {plan.price === 0 ? 'Get Started' : 'Upgrade Now'}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full px-4 py-3 rounded-lg font-semibold"
                      style={{ backgroundColor: theme.colors.border, color: theme.colors.text }}
                    >
                      Current Plan
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-6 rounded-xl glass-card">
            <div className="flex items-start gap-4">
              <Zap className="w-8 h-8 flex-shrink-0" style={{ color: theme.colors.accent }} />
              <div>
                <h3 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
                  Powered by LemonSqueezy
                </h3>
                <p className="text-sm mb-3" style={{ color: theme.colors.textSecondary }}>
                  Secure payments processed by LemonSqueezy. All plans include 14-day money-back guarantee.
                  Cancel anytime with no questions asked.
                </p>
                <div className="flex items-center gap-4 text-xs" style={{ color: theme.colors.textSecondary }}>
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    SSL Encrypted
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    PCI Compliant
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Cancel Anytime
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
