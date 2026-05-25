// Billing & Subscription Management Page
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    CreditCard, Check, Zap, Users, Shield,
    Sparkles, Crown, Building2, Download,
    ChevronRight, Calendar, Loader2
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Badge } from '../components/atoms';
import { api } from '../lib/api';

type PlanFeature = string | { name: string };

interface BackendPlan {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
    description: string;
    features: PlanFeature[];
    highlighted?: boolean;
    badge?: string;
}

interface Plan {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
    description: string;
    features: string[]; // This might need mapping if backend returns feature objects
    highlighted?: boolean;
    badge?: string;
    icon?: LucideIcon; // We'll map icons based on plan ID
}

interface Subscription {
    planId?: string;
    status?: string;
    currentPeriodEnd?: string | number | Date;
    default_payment_method?: {
        card?: {
            last4?: string;
            brand?: string;
            exp_month?: string | number;
            exp_year?: string | number;
        };
    };
}

interface UsageMetrics {
    testExecutionCount?: number;
    recordingCount?: number;
    apiCallCount?: number;
    storageUsedMB?: number;
}

interface Invoice {
    id: string;
    hostedInvoiceUrl: string;
    created: number;
    number: string;
    amount_paid: number;
    status: string;
}

const fallbackPlans: Plan[] = [
    {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: 'usd',
        interval: 'month',
        description: 'Ship the released Qestro wedge with core dashboard, cases, runs, and recordings.',
        features: [
            'Workspace dashboard',
            'Test case management',
            'Test run shell',
            'Recording Studio access',
            'Local fallback data'
        ],
        icon: Zap
    },
    {
        id: 'pro',
        name: 'Professional',
        price: 4900,
        currency: 'usd',
        interval: 'month',
        description: 'Expanded execution and collaboration capacity for active QA teams.',
        features: [
            'Unlimited projects',
            'Advanced analytics',
            'Shared workspaces',
            'Priority support',
            'Extended AI tooling'
        ],
        highlighted: true,
        badge: 'Most Popular',
        icon: Sparkles
    },
    {
        id: 'team',
        name: 'Team',
        price: 12900,
        currency: 'usd',
        interval: 'month',
        description: 'Team administration, shared governance, and higher execution limits.',
        features: [
            'Team seats',
            'Role-aware workspaces',
            'Audit history',
            'Workflow automations',
            'Usage controls'
        ],
        icon: Users
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: -1,
        currency: 'usd',
        interval: 'month',
        description: 'Custom security, compliance, and deployment support.',
        features: [
            'SSO and SCIM',
            'Private deployment support',
            'Enterprise SLA',
            'Custom onboarding',
            'Dedicated success team'
        ],
        badge: 'Contact Sales',
        icon: Building2
    }
];

const fallbackSubscription: Subscription = {
    planId: 'free',
    status: 'free'
};

const fallbackUsage: UsageMetrics = {
    testExecutionCount: 42,
    recordingCount: 6,
    apiCallCount: 128,
    storageUsedMB: 96
};

// Map backend plan data to UI structure
const mapPlanToUI = (backendPlan: BackendPlan): Plan => {
    let icon = Zap;
    if (backendPlan.id === 'professional' || backendPlan.id === 'pro') icon = Sparkles;
    if (backendPlan.id === 'team') icon = Users;
    if (backendPlan.id === 'enterprise') icon = Building2;

    // Convert feature objects to strings if necessary
    const features = backendPlan.features.map((f: PlanFeature) =>
        typeof f === 'string' ? f : f.name
    );

    return {
        ...backendPlan,
        icon,
        features
    };
};

export default function Billing() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [usage, setUsage] = useState<UsageMetrics | null>(null);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const [processing, setProcessing] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setStatusMessage(null);
                const [plansData, subData, usageData, invoicesData] = await Promise.all([
                    api.getPlans(),
                    api.getSubscription(),
                    api.getUsage(),
                    api.getInvoices()
                ]) as [
                    { success?: boolean; plans?: BackendPlan[] },
                    { success?: boolean; subscription?: Subscription },
                    { success?: boolean; usage?: UsageMetrics },
                    { success?: boolean; invoices?: Invoice[] }
                ];

                const resolvedPlans = plansData.success && Array.isArray(plansData.plans) && plansData.plans.length > 0
                    ? plansData.plans.map(mapPlanToUI)
                    : fallbackPlans;
                setPlans(resolvedPlans);
                setSubscription(subData.success ? (subData.subscription ?? fallbackSubscription) : fallbackSubscription);
                setUsage(usageData.success ? (usageData.usage ?? fallbackUsage) : fallbackUsage);
                setInvoices(invoicesData.success ? (invoicesData.invoices ?? []) : []);

                if (!plansData.success || !subData.success || !usageData.success || !invoicesData.success) {
                    setStatusMessage('Billing integrations are partially unavailable in this environment. Showing the release shell with fallback pricing and usage.');
                }
            } catch (error) {
                console.warn('Billing services are unavailable, using fallback billing data:', error);
                setPlans(fallbackPlans);
                setSubscription(fallbackSubscription);
                setUsage(fallbackUsage);
                setInvoices([]);
                setStatusMessage('Billing services are not configured in this environment. Showing fallback pricing and usage so the workflow remains usable.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleCheckout = async (planId: string) => {
        try {
            setProcessing(true);
            setStatusMessage(null);
            // If enterprise, would typically open contact form
            if (planId === 'enterprise') {
                window.location.href = 'mailto:sales@qestro.app';
                return;
            }

            const response = await api.createCheckoutSession(planId, billingCycle === 'annual' ? 'year' : 'month');
            if (response.success && response.checkoutUrl) {
                window.location.href = response.checkoutUrl;
                return;
            }
            setStatusMessage('Checkout is not available in this environment yet. Pricing remains visible for review.');
        } catch (error) {
            console.warn('Checkout is unavailable in this environment:', error);
            setStatusMessage('Checkout is not available in this environment yet. Pricing remains visible for review.');
        } finally {
            setProcessing(false);
        }
    };

    const handlePortal = async () => {
        try {
            setProcessing(true);
            setStatusMessage(null);

            if (!subscription || subscription.planId === 'free') {
                setStatusMessage('No paid subscription is attached to this workspace yet. Upgrade from one of the plans below to enable portal access.');
                return;
            }

            const response = await api.createBillingPortalSession();
            if (response.success && response.portalUrl) {
                window.location.href = response.portalUrl;
                return;
            }
            setStatusMessage('The billing portal is not available in this environment yet.');
        } catch (error) {
            console.warn('Billing portal is unavailable in this environment:', error);
            setStatusMessage('The billing portal is not available in this environment yet.');
        } finally {
            setProcessing(false);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    const getUsagePercentage = (used: number, limit: number) => {
        if (!limit || limit === -1) return 0;
        return Math.min((used / limit) * 100, 100);
    };

    const getUsageColor = (percentage: number) => {
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 70) return 'bg-yellow-500';
        return 'bg-primary';
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    const currentPlanId = subscription?.planId || 'free';
    const currentPlanDetails = plans.find(p => p.id === currentPlanId) ?? plans[0] ?? null;

    // Calculate display properties
    const renewalDate = subscription?.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
        : 'Never';

    return (
        <div className="py-6 px-6">
            <motion.div
                className="max-w-7xl mx-auto space-y-8"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold text-text-primary tracking-tight">
                        Billing & Subscription
                    </h1>
                    <p className="text-text-muted">
                        Manage your plan, usage, and payment methods
                    </p>
                </div>

                {statusMessage && (
                    <motion.div
                        variants={itemVariants}
                        className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                    >
                        {statusMessage}
                    </motion.div>
                )}

                {/* Current Plan Card */}
                <motion.div
                    variants={itemVariants}
                    className="bg-gradient-to-br from-primary/20 via-bg-secondary/50 to-bg-secondary/30 backdrop-blur-md border border-primary/30 rounded-2xl p-8"
                >
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                                <Crown className="w-7 h-7 text-primary" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-2xl font-bold text-white">{currentPlanDetails?.name || 'Free Plan'}</h2>
                                    <Badge variant={subscription?.status === 'active' ? 'success' : 'warning'} className="bg-primary/20 text-primary border-primary/30">
                                        {subscription?.status === 'active' ? 'Active' : (subscription?.status || 'Free')}
                                    </Badge>
                                </div>
                                <p className="text-text-muted mt-1">
                                    {currentPlanDetails?.price > 0
                                        ? `$${currentPlanDetails.price / 100}/${currentPlanDetails.interval} • Renews on ${renewalDate}`
                                        : 'Free Forever'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={handlePortal} disabled={processing}>
                                Manage Subscription
                            </Button>
                        </div>
                    </div>

                    {/* Usage Stats (Only show if we have usage data) */}
                    {usage && (
                        <div className="grid grid-cols-4 gap-6 mt-8">
                            {[
                                { label: 'Test Runs', used: usage.testExecutionCount || 0, limit: 1000, icon: Zap }, // Example limits, should come from plan
                                { label: 'Recordings', used: usage.recordingCount || 0, limit: 100, icon: Check },
                                { label: 'API Calls', used: usage.apiCallCount || 0, limit: 10000, icon: Users },
                                { label: 'Storage (MB)', used: usage.storageUsedMB || 0, limit: 1000, icon: Shield }
                            ].map((item) => {
                                const percentage = getUsagePercentage(item.used, item.limit);
                                return (
                                    <div key={item.label} className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-text-muted flex items-center gap-2">
                                                <item.icon className="w-4 h-4" />
                                                {item.label}
                                            </span>
                                            <span className="text-white font-medium">
                                                {item.used.toLocaleString()}
                                                {item.limit !== -1 && ` / ${item.limit.toLocaleString()}`}
                                            </span>
                                        </div>
                                        {item.limit !== -1 && (
                                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                                <motion.div
                                                    className={`h-full ${getUsageColor(percentage)} rounded-full`}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${percentage}%` }}
                                                    transition={{ duration: 0.5, delay: 0.2 }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>

                {/* Billing Cycle Toggle */}
                <motion.div variants={itemVariants} className="flex items-center justify-center gap-4">
                    <span className={`text-sm ${billingCycle === 'monthly' ? 'text-white' : 'text-text-muted'}`}>
                        Monthly
                    </span>
                    <button
                        onClick={() => setBillingCycle(prev => prev === 'monthly' ? 'annual' : 'monthly')}
                        className={`relative w-14 h-7 rounded-full transition-colors ${billingCycle === 'annual' ? 'bg-primary' : 'bg-white/20'
                            }`}
                    >
                        <motion.div
                            className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg"
                            animate={{ left: billingCycle === 'annual' ? '32px' : '4px' }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                    </button>
                    <span className={`text-sm flex items-center gap-2 ${billingCycle === 'annual' ? 'text-white' : 'text-text-muted'}`}>
                        Annual
                        <Badge variant="success" className="bg-green-500/20 text-green-400 border-green-500/30">
                            Save 20%
                        </Badge>
                    </span>
                </motion.div>

                {/* Plans Grid */}
                <motion.div variants={itemVariants} className="grid grid-cols-4 gap-6">
                    {plans.map((plan) => {
                        const isCurrentPlan = plan.id === currentPlanId;
                        const Icon = plan.icon || Zap;
                        // Approximate annual calculation if backend sends monthly price
                        const displayPrice = billingCycle === 'annual' && plan.price > 0 && plan.interval === 'month'
                            ? Math.round(plan.price * 12 * 0.8 / 100) // divide by 100 for cents
                            : Math.round(plan.price / 100);

                        const periodDisplay = billingCycle === 'annual' ? 'year' : plan.interval;

                        return (
                            <motion.div
                                key={plan.id}
                                whileHover={{ y: -4 }}
                                className={`relative bg-bg-secondary/50 backdrop-blur-md rounded-2xl p-6 border transition-all duration-300 ${plan.highlighted
                                    ? 'border-primary/50 shadow-[0_0_30px_rgba(59,130,246,0.15)]'
                                    : isCurrentPlan
                                        ? 'border-green-500/50'
                                        : 'border-border hover:border-white/20'
                                    }`}
                            >
                                {plan.badge && (
                                    <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold ${plan.highlighted
                                        ? 'bg-primary text-white'
                                        : 'bg-white/10 text-text-muted'
                                        }`}>
                                        {plan.badge}
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${plan.highlighted ? 'bg-primary/20' : 'bg-white/10'
                                        }`}>
                                        <Icon className={`w-5 h-5 ${plan.highlighted ? 'text-primary' : 'text-text-muted'}`} />
                                    </div>
                                    <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                                </div>

                                <div className="mb-4">
                                    {plan.price === -1 || plan.price === 0 && plan.name === 'Enterprise' ? ( // Handle enterprise case
                                        <div className="text-2xl font-bold text-white">Custom</div>
                                    ) : (
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-bold text-white">${displayPrice}</span>
                                            <span className="text-text-muted">/{periodDisplay}</span>
                                        </div>
                                    )}
                                    <p className="text-sm text-text-muted mt-1">{plan.description}</p>
                                </div>

                                <ul className="space-y-2 mb-6">
                                    {plan.features.slice(0, 8).map((feature: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                                            <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    variant={isCurrentPlan ? 'outline' : plan.highlighted ? 'neon' : 'glass'}
                                    className="w-full"
                                    disabled={isCurrentPlan || processing}
                                    onClick={() => handleCheckout(plan.id)}
                                >
                                    {isCurrentPlan ? 'Current Plan' : (plan.price === -1 || plan.price === 0 && plan.name === 'Enterprise') ? 'Contact Sales' : 'Upgrade'}
                                </Button>
                            </motion.div>
                        );
                    })}
                </motion.div>

                {/* Payment Method & Invoices */}
                <motion.div variants={itemVariants} className="grid grid-cols-2 gap-8">
                    {/* Payment Method - Only show if subscription exists and not free */}
                    {subscription && subscription.planId !== 'free' && (
                        <div className="bg-bg-secondary/50 backdrop-blur-md border border-border rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                        <CreditCard className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-white">Payment Method</h3>
                                </div>
                                <Button variant="ghost" size="sm" onClick={handlePortal}>
                                    Manage
                                </Button>
                            </div>

                            <div className="p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-white/10">
                                <div className="flex justify-between items-start mb-8">
                                    <div className="text-xl font-bold text-white tracking-widest">
                                        •••• •••• •••• {subscription.default_payment_method?.card?.last4 || '4242'}
                                    </div>
                                    <div className="text-white/60 text-sm capitalize">{subscription.default_payment_method?.card?.brand || 'Card'}</div>
                                </div>
                                <div className="flex justify-between">
                                    <div>
                                        <div className="text-xs text-white/40 uppercase">Expires</div>
                                        <div className="text-white font-medium">
                                            {subscription.default_payment_method?.card?.exp_month || '10'} / {subscription.default_payment_method?.card?.exp_year || '25'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Invoices */}
                    <div className="bg-bg-secondary/50 backdrop-blur-md border border-border rounded-xl p-6 col-span-2 md:col-span-1">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                                    <Calendar className="w-5 h-5 text-purple-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white">Billing History</h3>
                            </div>
                            <Button variant="ghost" size="sm" onClick={handlePortal}>
                                View All
                            </Button>
                        </div>

                        {invoices.length > 0 ? (
                            <div className="space-y-3">
                                {invoices.map((invoice) => (
                                    <div
                                        key={invoice.id}
                                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors group cursor-pointer"
                                        onClick={() => window.open(invoice.hostedInvoiceUrl, '_blank')}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                                                <Download className="w-4 h-4 text-text-muted group-hover:text-primary transition-colors" />
                                            </div>
                                            <div>
                                                <div className="text-sm text-white font-medium">{new Date(invoice.created * 1000).toLocaleDateString()}</div>
                                                <div className="text-xs text-text-muted">{invoice.number}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-white font-medium">${(invoice.amount_paid / 100).toFixed(2)}</span>
                                            <Badge variant={invoice.status === 'paid' ? 'success' : 'warning'} className="bg-green-500/10 text-green-400 border-green-500/20">
                                                {invoice.status}
                                            </Badge>
                                            <ChevronRight className="w-4 h-4 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-text-muted py-8">
                                No invoices found.
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </div>
    );
}
