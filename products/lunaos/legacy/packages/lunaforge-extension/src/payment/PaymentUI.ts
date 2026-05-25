/**
 * 🌙 LunaForge Payment UI Components
 *
 * Professional user interface for payment and subscription management
 */

import * as vscode from 'vscode';
import { PayPlusManager, SubscriptionPlan } from './PayPlusManager';

export class PaymentUI {
    private payPlusManager: PayPlusManager;
    private statusBarItem: vscode.StatusBarItem;

    constructor(payPlusManager: PayPlusManager) {
        this.payPlusManager = payPlusManager;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.updateStatusBar();
    }

    /**
     * Initialize payment UI components
     */
    public async initialize(): Promise<void> {
        // Register commands
        const commands = [
            vscode.commands.registerCommand('lunaforge.upgradeSubscription', () => this.upgradeSubscription()),
            vscode.commands.registerCommand('lunaforge.viewSubscription', () => this.viewSubscription()),
            vscode.commands.registerCommand('lunaforge.manageBilling', () => this.manageBilling()),
            vscode.commands.registerCommand('lunaforge.viewPricing', () => this.viewPricing())
        ];

        // Update status bar periodically
        setInterval(() => this.updateStatusBar(), 60000); // Update every minute

        // Show status bar
        this.statusBarItem.show();
    }

    /**
     * Show subscription upgrade dialog
     */
    public async upgradeSubscription(): Promise<void> {
        await this.payPlusManager.showPlansDialog();
    }

    /**
     * View current subscription status
     */
    public async viewSubscription(): Promise<void> {
        const status = await this.payPlusManager.getSubscriptionStatus();

        if (!status.isActive) {
            const action = await vscode.window.showInformationMessage(
                'You are currently using LunaForge Free Tier. Upgrade to unlock premium features!',
                'Upgrade Now',
                'View Plans',
                'Cancel'
            );

            switch (action) {
                case 'Upgrade Now':
                    await this.payPlusManager.createSubscriptionPayment('lunaforge-professional-monthly');
                    break;
                case 'View Plans':
                    await this.payPlusManager.showPlansDialog();
                    break;
            }
            return;
        }

        // Show active subscription details
        const planName = status.plan?.name || 'Unknown';
        const expiresAt = status.expiresAt?.toLocaleDateString() || 'Lifetime';
        const features = status.plan?.features || [];

        const message = `
🌙 **LunaForge Subscription Status**

**Plan**: ${planName}
**Status**: ${status.cancelled ? 'Cancelled' : 'Active'}
**Expires**: ${expiresAt}

**Features**:
${features.map(f => `• ${f}`).join('\n')}

${status.cancelled ? '\n⚠️ Your subscription is cancelled. Access will expire on the expiration date.' : ''}
        `;

        const actions = status.cancelled ?
            ['Reactivate', 'Upgrade', 'Close'] :
            ['Manage Billing', 'Upgrade', 'Cancel Subscription', 'Close'];

        const action = await vscode.window.showInformationMessage(
            message,
            ...actions
        );

        switch (action) {
            case 'Reactivate':
                await this.payPlusManager.createSubscriptionPayment(status.plan?.id || 'lunaforge-professional-monthly');
                break;
            case 'Manage Billing':
                await this.manageBilling();
                break;
            case 'Upgrade':
                await this.upgradeSubscription();
                break;
            case 'Cancel Subscription':
                await this.cancelSubscription();
                break;
        }
    }

    /**
     * Manage billing settings
     */
    public async manageBilling(): Promise<void> {
        const status = await this.payPlusManager.getSubscriptionStatus();

        if (!status.isActive) {
            vscode.window.showWarningMessage('No active subscription found. Upgrade to LunaForge to manage billing.');
            return;
        }

        const actions = [
            'Update Payment Method',
            'View Invoice History',
            'Download Invoices',
            'Change Plan',
            'Cancel Subscription',
            'Close'
        ];

        const action = await vscode.window.showQuickPick(actions, {
            placeHolder: 'What would you like to manage?'
        });

        switch (action) {
            case 'Update Payment Method':
                await vscode.env.openExternal(vscode.Uri.parse('https://lunaforge.io/billing.html?action=payment-method'));
                break;
            case 'View Invoice History':
                await vscode.env.openExternal(vscode.Uri.parse('https://lunaforge.io/billing.html?action=invoices'));
                break;
            case 'Download Invoices':
                await vscode.env.openExternal(vscode.Uri.parse('https://lunaforge.io/billing.html?action=download'));
                break;
            case 'Change Plan':
                await this.upgradeSubscription();
                break;
            case 'Cancel Subscription':
                await this.cancelSubscription();
                break;
        }
    }

    /**
     * View pricing information
     */
    public async viewPricing(): Promise<void> {
        const plans = this.payPlusManager.getPlans();

        // Create pricing table
        const pricingMessage = `
🌙 **LunaForge Pricing Plans**

**🔥 Free Tier - $0/month**
${plans.find(p => p.tier === 'free')?.features.map(f => `• ${f}`).join('\n')}

**🚀 Professional - $29/month**
${plans.find(p => p.id === 'lunaforge-professional-monthly')?.features.map(f => `• ${f}`).join('\n')}

**🏢 Enterprise - $99/month**
${plans.find(p => p.id === 'lunaforge-enterprise-monthly')?.features.map(f => `• ${f}`).join('\n')}

*Save 17% with yearly billing!*

Ready to upgrade? Choose a plan below.
        `;

        const action = await vscode.window.showInformationMessage(
            pricingMessage,
            'Start Professional Trial',
            'Compare Plans',
            'Enterprise Contact',
            'Close'
        );

        switch (action) {
            case 'Start Professional Trial':
                await this.payPlusManager.createSubscriptionPayment('lunaforge-professional-monthly');
                break;
            case 'Compare Plans':
                await this.payPlusManager.showPlansDialog();
                break;
            case 'Enterprise Contact':
                await vscode.env.openExternal(vscode.Uri.parse('mailto:enterprise@lunaforge.io?subject=Enterprise LunaForge Inquiry'));
                break;
        }
    }

    /**
     * Cancel subscription with confirmation
     */
    private async cancelSubscription(): Promise<void> {
        const status = await this.payPlusManager.getSubscriptionStatus();

        if (!status.isActive) {
            vscode.window.showInformationMessage('No active subscription to cancel.');
            return;
        }

        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to cancel your ${status.plan?.name} subscription?` +
            '\n\nYou will continue to have access until the end of your current billing period.',
            'Yes, Cancel Subscription',
            'No, Keep Subscription'
        );

        if (confirm === 'Yes, Cancel Subscription') {
            const result = await this.payPlusManager.cancelSubscription();

            if (result.success) {
                vscode.window.showInformationMessage(
                    'Subscription cancelled successfully. You will have access until the end of your billing period.'
                );
                await this.updateStatusBar();
            } else {
                vscode.window.showErrorMessage(`Failed to cancel subscription: ${result.error}`);
            }
        }
    }

    /**
     * Update status bar with subscription status
     */
    private async updateStatusBar(): Promise<void> {
        const status = await this.payPlusManager.getSubscriptionStatus();

        if (!status.isActive) {
            this.statusBarItem.text = '$(star-empty) LunaForge Free';
            this.statusBarItem.tooltip = 'LunaForge Free Tier - Click to upgrade';
            this.statusBarItem.command = 'lunaforge.upgradeSubscription';
            this.statusBarItem.color = undefined;
        } else if (status.plan?.tier === 'enterprise') {
            this.statusBarItem.text = '$(star-full) LunaForge Enterprise';
            this.statusBarItem.tooltip = `LunaForge Enterprise - ${status.plan?.name}\nExpires: ${status.expiresAt?.toLocaleDateString()}`;
            this.statusBarItem.command = 'lunaforge.viewSubscription';
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        } else {
            this.statusBarItem.text = '$(star-full) LunaForge Pro';
            this.statusBarItem.tooltip = `LunaForge Professional - ${status.plan?.name}\nExpires: ${status.expiresAt?.toLocaleDateString()}`;
            this.statusBarItem.command = 'lunaforge.viewSubscription';
            this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
        }
    }

    /**
     * Show usage limit warning
     */
    public async showUsageLimitWarning(type: 'files' | 'analyses'): Promise<void> {
        const status = await this.payPlusManager.getSubscriptionStatus();
        const limits = await this.payPlusManager.getUsageLimits();

        if (limits.hasUnlimitedAccess) {
            return; // No limits for enterprise users
        }

        const limitType = type === 'files' ? 'file limit' : 'daily analysis limit';
        const upgradePlan = status.plan?.tier === 'free' ? 'Professional' : 'Enterprise';

        const message = `You've reached your ${limitType} for LunaForge ${status.plan?.name || 'Free'}. Upgrade to ${upgradePlan} for unlimited ${type}.`;

        const action = await vscode.window.showWarningMessage(
            message,
            `Upgrade to ${upgradePlan}`,
            'View Plans',
            'Close'
        );

        switch (action) {
            case `Upgrade to ${upgradePlan}`:
                if (upgradePlan === 'Professional') {
                    await this.payPlusManager.createSubscriptionPayment('lunaforge-professional-monthly');
                } else {
                    await this.payPlusManager.createSubscriptionPayment('lunaforge-enterprise-monthly');
                }
                break;
            case 'View Plans':
                await this.payPlusManager.showPlansDialog();
                break;
        }
    }

    /**
     * Show payment success notification
     */
    public async showPaymentSuccess(plan: SubscriptionPlan): Promise<void> {
        const message = `
🎉 **Payment Successful!**

Welcome to LunaForge ${plan.name}!

Your subscription is now active and you have access to:
${plan.features.slice(0, 5).map(f => `✅ ${f}`).join('\n')}

Start exploring premium features right away!
        `;

        await vscode.window.showInformationMessage(
            message,
            'Open LunaForge Control Center',
            'View Features',
            'Close'
        );
    }

    /**
     * Show payment failure notification
     */
    public async showPaymentFailure(error: string): Promise<void> {
        await vscode.window.showErrorMessage(
            `Payment failed: ${error}\n\nPlease try again or contact support if the issue persists.`,
            'Try Again',
            'Contact Support',
            'Close'
        );
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.statusBarItem.dispose();
    }
}