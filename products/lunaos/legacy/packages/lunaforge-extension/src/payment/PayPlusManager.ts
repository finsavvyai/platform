/**
 * 🌙 LunaForge PayPlus Payment Integration
 *
 * Professional payment processing for LunaForge premium features
 * Supports subscriptions, one-time payments, and enterprise billing
 */

import * as vscode from 'vscode';

export interface PayPlusConfig {
    apiKey: string;
    environment: 'sandbox' | 'production';
    merchantId: string;
    secretKey: string;
    // Lemon Squeezy integration
    lemonSqueezyStoreId?: string;
    workerUrl?: string;
}

export interface SubscriptionPlan {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: 'month' | 'year';
    features: string[];
    tier: 'free' | 'professional' | 'enterprise';
}

export interface PaymentResult {
    success: boolean;
    transactionId?: string;
    subscriptionId?: string;
    error?: string;
    plan?: SubscriptionPlan;
}

export class PayPlusManager {
    private config: PayPlusConfig;
    private static instance: PayPlusManager;

    private context?: vscode.ExtensionContext;
    private core: any | null = null; // Type as any to avoid circular dependency

    constructor(config: PayPlusConfig, context?: vscode.ExtensionContext) {
        this.config = config;
        this.context = context;
    }

    public setCore(core: any) {
        this.core = core;
    }

    private get apiKey(): string {
        return this.config.apiKey;
    }

    public static getInstance(config?: PayPlusConfig): PayPlusManager {
        if (!PayPlusManager.instance) {
            if (!config) {
                throw new Error('PayPlus config required for first initialization');
            }
            PayPlusManager.instance = new PayPlusManager(config, (config as any).context);
        }
        return PayPlusManager.instance;
    }

    /**
     * Get available subscription plans
     */
    public getPlans(): SubscriptionPlan[] {
        return [
            {
                id: 'lunaforge-free',
                name: 'Free Tier',
                price: 0,
                currency: 'USD',
                interval: 'month',
                tier: 'free',
                features: [
                    'Up to 1,000 files per project',
                    '1 analysis per day',
                    'Basic visualization',
                    'Community support'
                ]
            },
            {
                id: 'lunaforge-professional-monthly',
                name: 'Professional Monthly',
                price: 29,
                currency: 'USD',
                interval: 'month',
                tier: 'professional',
                features: [
                    'Unlimited project size',
                    'All 12 analysis modes',
                    'AI-powered recommendations',
                    'Advanced export options',
                    'Priority email support',
                    'Unlimited daily analyses'
                ]
            },
            {
                id: 'lunaforge-professional-yearly',
                name: 'Professional Yearly',
                price: 290,
                currency: 'USD',
                interval: 'year',
                tier: 'professional',
                features: [
                    'Everything in Professional Monthly',
                    'Save 17% with annual billing',
                    'Priority feature requests'
                ]
            },
            {
                id: 'lunaforge-enterprise-monthly',
                name: 'Enterprise Monthly',
                price: 99,
                currency: 'USD',
                interval: 'month',
                tier: 'enterprise',
                features: [
                    'Everything in Professional',
                    'Team collaboration (up to 25 users)',
                    'Advanced security features',
                    'API access',
                    'Dedicated Slack support',
                    'Onboarding session',
                    'Custom reporting'
                ]
            },
            {
                id: 'lunaforge-enterprise-yearly',
                name: 'Enterprise Yearly',
                price: 990,
                currency: 'USD',
                interval: 'year',
                tier: 'enterprise',
                features: [
                    'Everything in Enterprise Monthly',
                    'Save 17% with annual billing',
                    'Custom integration support'
                ]
            }
        ];
    }

    /**
     * Create payment session for subscription
     * Uses Lemon Squeezy checkout if configured, otherwise opens pricing page
     */
    public async createSubscriptionPayment(planId: string): Promise<PaymentResult> {
        try {
            const plan = this.getPlans().find(p => p.id === planId);
            if (!plan) {
                return {
                    success: false,
                    error: `Plan ${planId} not found`
                };
            }

            // Lemon Squeezy product variant IDs (actual IDs from store)
            const lemonSqueezyVariants: Record<string, string> = {
                'lunaforge-professional-monthly': '1185964',
                'lunaforge-professional-yearly': '1185980',
                'lunaforge-enterprise-monthly': '1185989',
                'lunaforge-enterprise-yearly': '1186003'
            };

            const variantId = lemonSqueezyVariants[planId];

            if (variantId && variantId !== 'REPLACE_WITH_VARIANT_ID') {
                // Use real Lemon Squeezy checkout
                const email = await this.getUserEmail();
                const checkoutUrl = `https://finsavvy.lemonsqueezy.com/checkout/buy/${variantId}?checkout[email]=${encodeURIComponent(email)}`;

                await vscode.env.openExternal(vscode.Uri.parse(checkoutUrl));

                return {
                    success: true,
                    transactionId: `ls_${Date.now()}`,
                    plan: plan
                };
            } else {
                // Fallback: open pricing page
                await vscode.env.openExternal(vscode.Uri.parse('https://www.lunaforge.io/pricing'));

                return {
                    success: true,
                    transactionId: `pricing_redirect_${Date.now()}`,
                    plan: plan
                };
            }

        } catch (error) {
            return {
                success: false,
                error: `Payment creation failed: ${(error as Error).message}`
            };
        }
    }

    /**
     * Check current subscription status
     * Verifies against backend API first, then falls back to local storage
     */
    public async getSubscriptionStatus(): Promise<{
        isActive: boolean;
        plan?: SubscriptionPlan;
        expiresAt?: Date;
        cancelled: boolean;
    }> {
        try {
            // First try to verify against backend API
            if (this.config.workerUrl) {
                const email = await this.getUserEmail();
                if (email && email !== 'user@example.com') {
                    try {
                        const response = await fetch(`${this.config.workerUrl}/v1/subscription/verify`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email })
                        });

                        if (response.ok) {
                            const serverStatus = await response.json() as {
                                isActive: boolean;
                                tier: string;
                                planId?: string;
                                expiresAt?: string;
                                status?: string;
                            };

                            if (serverStatus.isActive) {
                                const plan = this.getPlans().find(p =>
                                    p.id === serverStatus.planId || p.tier === serverStatus.tier
                                );

                                // Cache the subscription locally
                                await this.updateStoredSubscription({
                                    planId: serverStatus.planId || plan?.id,
                                    tier: serverStatus.tier,
                                    expiresAt: serverStatus.expiresAt,
                                    verified: true
                                });

                                return {
                                    isActive: true,
                                    plan: plan,
                                    expiresAt: serverStatus.expiresAt ? new Date(serverStatus.expiresAt) : undefined,
                                    cancelled: serverStatus.status === 'cancelled'
                                };
                            }
                        }
                    } catch (apiError) {
                        console.warn('Backend subscription check failed, using local cache:', apiError);
                    }
                }
            }

            // Fall back to local storage
            const subscriptionData = await this.getStoredSubscription();

            if (!subscriptionData) {
                return {
                    isActive: false,
                    cancelled: false
                };
            }

            // Verify subscription is still active
            if (subscriptionData.expiresAt && new Date(subscriptionData.expiresAt) < new Date()) {
                return {
                    isActive: false,
                    cancelled: true
                };
            }

            const plan = this.getPlans().find(p => p.id === subscriptionData.planId);

            return {
                isActive: true,
                plan: plan,
                expiresAt: subscriptionData.expiresAt ? new Date(subscriptionData.expiresAt) : undefined,
                cancelled: subscriptionData.cancelled || false
            };

        } catch (error) {
            console.error('Failed to check subscription status:', error);
            return {
                isActive: false,
                cancelled: false
            };
        }
    }

    /**
     * Cancel subscription
     */
    public async cancelSubscription(): Promise<PaymentResult> {
        try {
            const subscription = await this.getStoredSubscription();

            if (!subscription || !subscription.subscriptionId) {
                return {
                    success: false,
                    error: 'No active subscription found'
                };
            }

            const response = await this.callPayPlusAPI('/subscription/cancel', {
                subscription_id: subscription.subscriptionId,
                reason: 'User requested cancellation'
            });

            if (response.success) {
                // Update local storage
                await this.updateStoredSubscription({
                    ...subscription,
                    cancelled: true,
                    cancelledAt: new Date().toISOString()
                });

                return {
                    success: true,
                    subscriptionId: subscription.subscriptionId
                };
            } else {
                return {
                    success: false,
                    error: response.error || 'Failed to cancel subscription'
                };
            }

        } catch (error) {
            return {
                success: false,
                error: `Cancellation failed: ${(error as Error).message}`
            };
        }
    }

    /**
     * Show subscription upgrade prompt
     */
    public async showUpgradePrompt(feature: string): Promise<void> {
        const currentStatus = await this.getSubscriptionStatus();

        if (currentStatus.isActive && currentStatus.plan?.tier === 'enterprise') {
            return; // Already has highest tier
        }

        const action = await vscode.window.showInformationMessage(
            `"${feature}" requires LunaForge ${currentStatus.plan?.tier === 'professional' ? 'Enterprise' : 'Professional'}. Upgrade now to unlock premium features!`,
            'Upgrade to Professional',
            'Upgrade to Enterprise',
            'View Plans',
            'Remind Later'
        );

        switch (action) {
            case 'Upgrade to Professional':
                await this.createSubscriptionPayment('lunaforge-professional-monthly');
                break;
            case 'Upgrade to Enterprise':
                await this.createSubscriptionPayment('lunaforge-enterprise-monthly');
                break;
            case 'View Plans':
                await this.showPlansDialog();
                break;
            case 'Remind Later':
                // Schedule reminder for later
                break;
        }
    }

    /**
     * Show pricing plans dialog
     */
    public async showPlansDialog(): Promise<void> {
        const plans = this.getPlans();
        const planItems = plans
            .filter(p => p.price > 0)
            .map(plan => ({
                label: `$(star) ${plan.name}`,
                description: `$${plan.price}/${plan.interval === 'month' ? 'mo' : 'yr'}`,
                detail: plan.features.slice(0, 4).join(' • '),
                planId: plan.id,
                plan: plan
            }));

        const selected = await vscode.window.showQuickPick(planItems, {
            placeHolder: '💎 Select a LunaForge subscription plan',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            const featureList = selected.plan.features.map(f => `• ${f}`).join('\n');
            const confirm = await vscode.window.showInformationMessage(
                `Upgrade to ${selected.plan.name}?\n\n${featureList}`,
                { modal: true },
                'Start Subscription',
                'Learn More'
            );

            if (confirm === 'Start Subscription') {
                await this.createSubscriptionPayment(selected.planId);
            } else if (confirm === 'Learn More') {
                // Fix: Point to working pricing page
                await vscode.env.openExternal(vscode.Uri.parse('https://www.lunaforge.io/pricing'));
            }
        }
    }

    /**
     * Verifies current license status with timeout
     */
    public async checkLicense(silent: boolean = false): Promise<boolean> {
        if (!this.core) return false;

        try {
            // Add 5s timeout to prevent hanging
            const timeoutPromise = new Promise<boolean>((_, reject) =>
                setTimeout(() => reject(new Error('License check timed out')), 5000)
            );

            const checkPromise = async () => {
                // Mock implementation for demo if API key is missing
                if (!this.apiKey) {
                    if (!silent) {
                        vscode.window.showInformationMessage('LunaForge is running in Demo Mode (No API Key configured)');
                    }
                    return false;
                }

                // TODO: Real API verification would go here
                return true;
            };

            return await Promise.race([checkPromise(), timeoutPromise]);
        } catch (error) {
            console.error('License check failed:', error);
            if (!silent) {
                vscode.window.showWarningMessage('Could not verify license. Creating offline session.');
            }
            return false;
        }
    }

    /**
     * Check if user has access to premium features
     */
    public async hasPremiumAccess(): Promise<boolean> {
        const status = await this.getSubscriptionStatus();
        return status.isActive && (status.plan?.tier === 'professional' || status.plan?.tier === 'enterprise');
    }

    /**
     * Check if user has enterprise access
     */
    public async hasEnterpriseAccess(): Promise<boolean> {
        const status = await this.getSubscriptionStatus();
        return status.isActive && status.plan?.tier === 'enterprise';
    }

    /**
     * Get current usage limits
     */
    public async getUsageLimits(): Promise<{
        maxFiles: number;
        maxAnalysesPerDay: number;
        hasUnlimitedAccess: boolean;
    }> {
        const status = await this.getSubscriptionStatus();

        if (!status.isActive || !status.plan) {
            return {
                maxFiles: 1000,
                maxAnalysesPerDay: 1,
                hasUnlimitedAccess: false
            };
        }

        switch (status.plan.tier) {
            case 'professional':
                return {
                    maxFiles: 10000,
                    maxAnalysesPerDay: 100,
                    hasUnlimitedAccess: false
                };
            case 'enterprise':
                return {
                    maxFiles: Number.MAX_SAFE_INTEGER,
                    maxAnalysesPerDay: Number.MAX_SAFE_INTEGER,
                    hasUnlimitedAccess: true
                };
            default:
                return {
                    maxFiles: 1000,
                    maxAnalysesPerDay: 1,
                    hasUnlimitedAccess: false
                };
        }
    }

    // Private helper methods

    private generateSessionId(): string {
        return `lunaforge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async getUserEmail(): Promise<string> {
        // 1. Check if we have a stored email
        if (this.context) {
            const storedEmail = this.context.globalState.get<string>('userEmail');
            if (storedEmail) {
                return storedEmail;
            }
        }

        // 2. Try to get email from VS Code's GitHub authentication
        try {
            const session = await vscode.authentication.getSession('github', ['user:email'], { createIfNone: false });
            if (session?.account?.label) {
                // GitHub account label is usually the username, but let's try to get email
                // The email might be in the account info or we need to query GitHub API
                const email = await this.getGitHubEmail(session.accessToken);
                if (email) {
                    await this.storeUserEmail(email);
                    return email;
                }
            }
        } catch (error) {
            console.log('GitHub auth not available:', error);
        }

        // 3. Try Microsoft authentication
        try {
            const session = await vscode.authentication.getSession('microsoft', ['email', 'openid', 'profile'], { createIfNone: false });
            if (session?.account?.label && session.account.label.includes('@')) {
                await this.storeUserEmail(session.account.label);
                return session.account.label;
            }
        } catch (error) {
            console.log('Microsoft auth not available:', error);
        }

        // 4. Prompt user for email
        const email = await vscode.window.showInputBox({
            prompt: 'Enter your email address for LunaForge subscription',
            placeHolder: 'you@example.com',
            validateInput: (value) => {
                if (!value || !value.includes('@') || !value.includes('.')) {
                    return 'Please enter a valid email address';
                }
                return undefined;
            }
        });

        if (email) {
            await this.storeUserEmail(email);
            return email;
        }

        // Fallback - this shouldn't happen in normal usage
        return 'user@example.com';
    }

    private async getGitHubEmail(accessToken: string): Promise<string | null> {
        try {
            const response = await fetch('https://api.github.com/user/emails', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'LunaForge-VSCode'
                }
            });

            if (response.ok) {
                const emails = await response.json() as Array<{ email: string; primary: boolean; verified: boolean }>;
                // Find primary verified email
                const primary = emails.find(e => e.primary && e.verified);
                if (primary) {
                    return primary.email;
                }
                // Fallback to any verified email
                const verified = emails.find(e => e.verified);
                if (verified) {
                    return verified.email;
                }
            }
        } catch (error) {
            console.error('Failed to fetch GitHub email:', error);
        }
        return null;
    }

    private async storeUserEmail(email: string): Promise<void> {
        if (this.context) {
            await this.context.globalState.update('userEmail', email);
        }
    }

    private async getStoredSubscription(): Promise<any> {
        if (this.context) {
            return this.context.globalState.get('subscription');
        }
        return null;
    }

    private async updateStoredSubscription(data: any): Promise<void> {
        if (this.context) {
            await this.context.globalState.update('subscription', data);
        }
    }

    private async callPayPlusAPI(endpoint: string, payload: any): Promise<any> {
        // Check if we're in demo mode
        if (this.config.apiKey === 'demo-key') {
            return this.simulatePayPlusResponse(endpoint, payload);
        }

        const baseUrl = this.config.environment === 'production'
            ? 'https://api.payplus.com'
            : 'https://sandbox-api.payplus.com';

        const response = await fetch(`${baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
                'X-Merchant-ID': this.config.merchantId
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`PayPlus API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    private simulatePayPlusResponse(endpoint: string, payload: any): any {
        // Simulate PayPlus API responses for demo purposes
        if (endpoint.includes('/payment/session')) {
            return {
                success: true,
                session_id: payload.session_id || 'demo_session_' + Date.now(),
                payment_url: 'https://demo-payplus.com/pay/' + payload.session_id,
                message: 'Demo payment session created successfully'
            };
        }

        if (endpoint.includes('/subscription/cancel')) {
            return {
                success: true,
                subscription_id: payload.subscription_id || 'demo_sub_' + Date.now(),
                message: 'Demo subscription cancelled successfully'
            };
        }

        return {
            success: true,
            message: 'Demo operation completed successfully'
        };
    }
}

// Export singleton instance creator
export function createPayPlusManager(config: PayPlusConfig, context?: vscode.ExtensionContext): PayPlusManager {
    if (context) {
        (config as any).context = context;
    }
    return PayPlusManager.getInstance(config);
}