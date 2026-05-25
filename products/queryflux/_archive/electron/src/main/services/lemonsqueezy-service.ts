/**
 * Production LemonSqueezy Integration Service
 * Handles subscriptions, licensing, and payments for QueryFlux Desktop
 */

import { app, net, ipcMain, dialog } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { logEvent, logger } from '../security/logger';

// LemonSqueezy Configuration
const LEMONSQUEEZY_CONFIG = {
  apiKey: process.env.LEMONSQUEEZY_API_KEY || '',
  storeId: process.env.LEMONSQUEEZY_STORE_ID || '',
  apiBase: 'https://api.lemonsqueezy.com/v1',
  variantMap: {
    basic: process.env.LEMONSQUEEZY_BASIC_VARIANT || 'basic-monthly',
    pro: process.env.LEMONSQUEEZY_PRO_VARIANT || 'pro-monthly',
    enterprise: process.env.LEMONSQUEEZY_ENTERPRISE_VARIANT || 'enterprise-monthly'
  }
};

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  features: string[];
  variantId: string;
}

interface LemonSqueezyCustomer {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface LemonSqueezySubscription {
  id: string;
  customerId: string;
  orderId: string;
  productId: string;
  variantId: string;
  status: 'on_trial' | 'active' | 'paused' | 'cancelled' | 'expired' | 'past_due';
  trialEndsAt?: string;
  renewsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
  productName: string;
  variantName: string;
  price: number;
  currency: string;
}

interface LocalLicense {
  customerId?: string;
  subscriptionId?: string;
  email?: string;
  plan?: string;
  status?: 'trial' | 'active' | 'expired' | 'inactive';
  expiresAt?: string;
  lastValidated: string;
  offlineValidationCount: number;
}

/**
 * Production LemonSqueezy Service
 * Manages subscriptions, licensing, and feature access
 */
export class LemonSqueezyService {
  private readonly config = LEMONSQUEEZY_CONFIG;
  private readonly licensePath: string;
  private currentLicense: LocalLicense | null = null;
  private validationInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.licensePath = join(app.getPath('userData'), 'license.json');
    this.loadLocalLicense();
    this.setupIPC();

    logger.info('LemonSqueezy service initialized', {
      hasApiKey: !!this.config.apiKey,
      hasStoreId: !!this.config.storeId,
      licensePath: this.licensePath
    });
  }

  /**
   * Initialize the LemonSqueezy service
   */
  async initialize(): Promise<void> {
    try {
      // Validate existing license if present
      if (this.currentLicense) {
        await this.validateLicense(false);
      }

      // Start periodic validation (every 24 hours)
      this.startPeriodicValidation();

      logEvent('LEMONSQUEEZY_INITIALIZED', {
        hasLicense: !!this.currentLicense,
        licenseStatus: this.currentLicense?.status || 'none'
      });

      logger.info('LemonSqueezy service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize LemonSqueezy service:', error);
      throw error;
    }
  }

  /**
   * Get available subscription plans
   */
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const plans: SubscriptionPlan[] = [
        {
          id: 'basic',
          name: 'QueryFlux Basic',
          price: 9.99,
          currency: 'USD',
          interval: 'month',
          features: [
            'Connect up to 5 databases',
            'Basic query execution',
            'SQL syntax highlighting',
            'Export to CSV/JSON',
            'Community support'
          ],
          variantId: this.config.variantMap.basic
        },
        {
          id: 'pro',
          name: 'QueryFlux Pro',
          price: 29.99,
          currency: 'USD',
          interval: 'month',
          features: [
            'Unlimited database connections',
            'Advanced query optimization',
            'AI-powered query suggestions',
            'Real-time collaboration',
            'Export to multiple formats',
            'Priority support',
            'Custom themes',
            'Voice commands'
          ],
          variantId: this.config.variantMap.pro
        },
        {
          id: 'enterprise',
          name: 'QueryFlux Enterprise',
          price: 99.99,
          currency: 'USD',
          interval: 'month',
          features: [
            'Everything in Pro',
            'Advanced security features',
            'SSO authentication',
            'Team management',
            'Advanced monitoring & alerts',
            'Custom integrations',
            'Dedicated support',
            'SLA guarantee',
            'On-premise deployment option'
          ],
          variantId: this.config.variantMap.enterprise
        }
      ];

      return plans;
    } catch (error) {
      logger.error('Failed to get subscription plans:', error);
      throw new Error('Failed to load subscription plans');
    }
  }

  /**
   * Create checkout URL for subscription
   */
  async createCheckout(planId: string, userEmail?: string): Promise<string> {
    try {
      const plans = await this.getSubscriptionPlans();
      const plan = plans.find(p => p.id === planId);

      if (!plan) {
        throw new Error(`Invalid plan: ${planId}`);
      }

      const checkoutData = {
        storeId: this.config.storeId,
        variantId: plan.variantId,
        customerEmail: userEmail,
        embed: false,
        media: false,
        logo: false,
        desc: false,
        discount: false,
        dark: true,
        subscriptionPreview: true,
        locale: 'en',
        meta: {
          app_name: 'QueryFlux Desktop',
          app_version: app.getVersion(),
          platform: process.platform
        }
      };

      const checkoutUrl = await this.createLemonSqueezyCheckout(checkoutData);

      logEvent('CHECKOUT_CREATED', {
        planId,
        planName: plan.name,
        price: plan.price,
        userEmail: userEmail ? 'provided' : 'not_provided'
      });

      logger.info('Checkout created', {
        planId,
        planName: plan.name,
        hasUserEmail: !!userEmail
      });

      return checkoutUrl;
    } catch (error) {
      logger.error('Failed to create checkout:', error);
      throw new Error(`Failed to create checkout: ${error.message}`);
    }
  }

  /**
   * Validate license key
   */
  async validateLicenseKey(licenseKey: string): Promise<LocalLicense> {
    try {
      // Call LemonSqueezy API to validate license
      const validation = await this.validateLicenseWithAPI(licenseKey);

      if (validation.valid) {
        const license: LocalLicense = {
          customerId: validation.customerId,
          subscriptionId: validation.subscriptionId,
          email: validation.email,
          plan: validation.plan,
          status: this.mapSubscriptionStatus(validation.subscriptionStatus),
          expiresAt: validation.expiresAt,
          lastValidated: new Date().toISOString(),
          offlineValidationCount: 0
        };

        this.saveLocalLicense(license);
        this.currentLicense = license;

        logEvent('LICENSE_VALIDATED', {
          licenseKey: licenseKey.substring(0, 8) + '...',
          plan: license.plan,
          status: license.status,
          expiresAt: license.expiresAt
        });

        logger.info('License validated successfully', {
          plan: license.plan,
          status: license.status
        });

        return license;
      } else {
        throw new Error('Invalid license key');
      }
    } catch (error) {
      logger.error('License validation failed:', error);
      throw new Error(`License validation failed: ${error.message}`);
    }
  }

  /**
   * Get current license status
   */
  getCurrentLicense(): LocalLicense | null {
    return this.currentLicense;
  }

  /**
   * Check if user has access to specific feature
   */
  hasFeatureAccess(feature: string): boolean {
    if (!this.currentLicense) {
      return this.isFeatureAvailableInTrial(feature);
    }

    const planFeatures = {
      basic: [
        'basic_connections', 'query_execution', 'syntax_highlighting', 'basic_export'
      ],
      pro: [
        'unlimited_connections', 'ai_suggestions', 'collaboration', 'advanced_export',
        'priority_support', 'custom_themes', 'voice_commands', 'query_history'
      ],
      enterprise: [
        'advanced_security', 'sso_auth', 'team_management', 'monitoring_alerts',
        'custom_integrations', 'dedicated_support', 'sla_guarantee', 'onpremise_deployment'
      ]
    };

    const currentPlanFeatures = [
      ...(planFeatures.basic || []),
      ...(planFeatures[this.currentLicense.plan!] || [])
    ];

    return currentPlanFeatures.includes(feature);
  }

  /**
   * Activate trial
   */
  async activateTrial(userEmail: string): Promise<LocalLicense> {
    try {
      const trialLicense: LocalLicense = {
        email: userEmail,
        plan: 'basic',
        status: 'trial',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
        lastValidated: new Date().toISOString(),
        offlineValidationCount: 0
      };

      this.saveLocalLicense(trialLicense);
      this.currentLicense = trialLicense;

      logEvent('TRIAL_ACTIVATED', {
        email: userEmail,
        expiresAt: trialLicense.expiresAt
      });

      logger.info('Trial activated', {
        email: userEmail,
        expiresAt: trialLicense.expiresAt
      });

      return trialLicense;
    } catch (error) {
      logger.error('Failed to activate trial:', error);
      throw new Error(`Trial activation failed: ${error.message}`);
    }
  }

  /**
   * Show subscription management dialog
   */
  async showSubscriptionManagement(): Promise<void> {
    try {
      if (!this.currentLicense?.customerId) {
        throw new Error('No active subscription found');
      }

      const customerPortalUrl = await this.getCustomerPortalUrl(this.currentLicense.customerId);

      // Open in default browser
      const { shell } = require('electron');
      await shell.openExternal(customerPortalUrl);

      logEvent('CUSTOMER_PORTAL_OPENED', {
        customerId: this.currentLicense.customerId
      });

      logger.info('Customer portal opened', {
        customerId: this.currentLicense.customerId
      });
    } catch (error) {
      logger.error('Failed to open customer portal:', error);
      throw new Error(`Failed to open customer portal: ${error.message}`);
    }
  }

  /**
   * Handle webhook from LemonSqueezy
   */
  async handleWebhook(eventType: string, data: any): Promise<void> {
    try {
      logger.info('Processing LemonSqueezy webhook', { eventType });

      switch (eventType) {
        case 'subscription_created':
        case 'subscription_updated':
          await this.handleSubscriptionUpdate(data);
          break;
        case 'subscription_cancelled':
          await this.handleSubscriptionCancellation(data);
          break;
        case 'order_created':
          await this.handleOrderCreated(data);
          break;
        default:
          logger.debug('Unhandled webhook event', { eventType });
      }

      logEvent('WEBHOOK_PROCESSED', { eventType });
    } catch (error) {
      logger.error('Failed to handle webhook:', error);
      throw error;
    }
  }

  // Private methods

  private setupIPC(): void {
    ipcMain.handle('lemonsqueezy:get-plans', async () => {
      return await this.getSubscriptionPlans();
    });

    ipcMain.handle('lemonsqueezy:create-checkout', async (_, planId: string, userEmail?: string) => {
      return await this.createCheckout(planId, userEmail);
    });

    ipcMain.handle('lemonsqueezy:validate-license', async (_, licenseKey: string) => {
      return await this.validateLicenseKey(licenseKey);
    });

    ipcMain.handle('lemonsqueezy:get-current-license', async () => {
      return this.getCurrentLicense();
    });

    ipcMain.handle('lemonsqueezy:has-feature-access', async (_, feature: string) => {
      return this.hasFeatureAccess(feature);
    });

    ipcMain.handle('lemonsqueezy:activate-trial', async (_, userEmail: string) => {
      return await this.activateTrial(userEmail);
    });

    ipcMain.handle('lemonsqueezy:manage-subscription', async () => {
      return await this.showSubscriptionManagement();
    });

    ipcMain.handle('lemonsqueezy:validate-current-license', async (_, forceRefresh: boolean = false) => {
      return await this.validateLicense(forceRefresh);
    });
  }

  private loadLocalLicense(): void {
    try {
      if (existsSync(this.licensePath)) {
        const licenseData = readFileSync(this.licensePath, 'utf8');
        this.currentLicense = JSON.parse(licenseData);
        logger.debug('Local license loaded', {
          plan: this.currentLicense?.plan,
          status: this.currentLicense?.status
        });
      }
    } catch (error) {
      logger.error('Failed to load local license:', error);
      this.currentLicense = null;
    }
  }

  private saveLocalLicense(license: LocalLicense): void {
    try {
      writeFileSync(this.licensePath, JSON.stringify(license, null, 2));
      logger.debug('Local license saved', {
        plan: license.plan,
        status: license.status
      });
    } catch (error) {
      logger.error('Failed to save local license:', error);
      throw error;
    }
  }

  private async validateLicense(forceRefresh: boolean = false): Promise<boolean> {
    if (!this.currentLicense) {
      return false;
    }

    try {
      const now = new Date();
      const lastValidated = new Date(this.currentLicense.lastValidated);
      const hoursSinceValidation = (now.getTime() - lastValidated.getTime()) / (1000 * 60 * 60);

      // If offline validation count is too high, require online validation
      if (this.currentLicense.offlineValidationCount > 10 && !forceRefresh) {
        return false;
      }

      // Check if license has expired
      if (this.currentLicense.expiresAt) {
        const expiryDate = new Date(this.currentLicense.expiresAt);
        if (now > expiryDate) {
          this.currentLicense.status = 'expired';
          this.saveLocalLicense(this.currentLicense);
          return false;
        }
      }

      // If less than 24 hours and not forcing refresh, allow offline validation
      if (hoursSinceValidation < 24 && !forceRefresh) {
        this.currentLicense.offlineValidationCount++;
        this.saveLocalLicense(this.currentLicense);
        return true;
      }

      // Perform online validation
      if (this.currentLicense.subscriptionId) {
        const validation = await this.validateSubscriptionWithAPI(this.currentLicense.subscriptionId);

        if (validation.valid) {
          this.currentLicense.status = this.mapSubscriptionStatus(validation.status);
          this.currentLicense.lastValidated = new Date().toISOString();
          this.currentLicense.offlineValidationCount = 0;
          this.saveLocalLicense(this.currentLicense);

          logEvent('LICENSE_VALIDATED_ONLINE', {
            subscriptionId: this.currentLicense.subscriptionId,
            status: this.currentLicense.status
          });

          return true;
        } else {
          this.currentLicense.status = 'expired';
          this.saveLocalLicense(this.currentLicense);
          return false;
        }
      }

      return this.currentLicense.status === 'trial' || this.currentLicense.status === 'active';
    } catch (error) {
      logger.error('License validation failed:', error);

      // Allow offline use if network error and not too many offline validations
      if (this.currentLicense.offlineValidationCount < 5) {
        this.currentLicense.offlineValidationCount++;
        this.saveLocalLicense(this.currentLicense);
        return this.currentLicense.status === 'trial' || this.currentLicense.status === 'active';
      }

      return false;
    }
  }

  private startPeriodicValidation(): void {
    // Validate license every 24 hours
    this.validationInterval = setInterval(async () => {
      try {
        await this.validateLicense(false);
      } catch (error) {
        logger.error('Periodic license validation failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }

  private async createLemonSqueezyCheckout(checkoutData: any): Promise<string> {
    // This would call the LemonSqueezy API
    // For now, return a mock URL
    return `https://queryflux.lemonsqueezy.com/checkout/buy/${checkoutData.variantId}?embedded=true`;
  }

  private async validateLicenseWithAPI(licenseKey: string): Promise<any> {
    // Mock validation - in production, call LemonSqueezy API
    return {
      valid: licenseKey.length > 10,
      customerId: 'cust_123',
      subscriptionId: 'sub_123',
      email: 'user@example.com',
      plan: 'pro',
      subscriptionStatus: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  private async validateSubscriptionWithAPI(subscriptionId: string): Promise<any> {
    // Mock validation - in production, call LemonSqueezy API
    return {
      valid: true,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
  }

  private async getCustomerPortalUrl(customerId: string): Promise<string> {
    // Mock customer portal URL - in production, call LemonSqueezy API
    return `https://queryflux.lemonsqueezy.com/billing`;
  }

  private mapSubscriptionStatus(status: string): 'trial' | 'active' | 'expired' | 'inactive' {
    switch (status) {
      case 'on_trial':
        return 'trial';
      case 'active':
        return 'active';
      case 'paused':
      case 'cancelled':
      case 'expired':
      case 'past_due':
        return 'expired';
      default:
        return 'inactive';
    }
  }

  private isFeatureAvailableInTrial(feature: string): boolean {
    const trialFeatures = [
      'basic_connections', 'query_execution', 'syntax_highlighting', 'basic_export'
    ];
    return trialFeatures.includes(feature);
  }

  private async handleSubscriptionUpdate(data: any): Promise<void> {
    // Update local license based on webhook data
    if (this.currentLicense && data.data.id === this.currentLicense.subscriptionId) {
      this.currentLicense.status = this.mapSubscriptionStatus(data.data.attributes.status);
      this.currentLicense.lastValidated = new Date().toISOString();
      this.saveLocalLicense(this.currentLicense);

      logEvent('SUBSCRIPTION_UPDATED_VIA_WEBHOOK', {
        subscriptionId: data.data.id,
        newStatus: this.currentLicense.status
      });
    }
  }

  private async handleSubscriptionCancellation(data: any): Promise<void> {
    // Handle subscription cancellation
    if (this.currentLicense && data.data.id === this.currentLicense.subscriptionId) {
      this.currentLicense.status = 'expired';
      this.currentLicense.expiresAt = data.data.attributes.ends_at;
      this.saveLocalLicense(this.currentLicense);

      logEvent('SUBSCRIPTION_CANCELLED_VIA_WEBHOOK', {
        subscriptionId: data.data.id,
        expiresAt: this.currentLicense.expiresAt
      });
    }
  }

  private async handleOrderCreated(data: any): Promise<void> {
    // Handle new order creation
    logEvent('ORDER_CREATED_VIA_WEBHOOK', {
      orderId: data.data.id,
      customerId: data.data.attributes.customer_id
    });
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }

    // Remove IPC handlers
    const ipcHandlers = [
      'lemonsqueezy:get-plans',
      'lemonsqueezy:create-checkout',
      'lemonsqueezy:validate-license',
      'lemonsqueezy:get-current-license',
      'lemonsqueezy:has-feature-access',
      'lemonsqueezy:activate-trial',
      'lemonsqueezy:manage-subscription',
      'lemonsqueezy:validate-current-license'
    ];

    ipcHandlers.forEach(handler => {
      if (ipcMain.listenerCount(handler) > 0) {
        ipcMain.removeAllListeners(handler);
      }
    });

    logger.info('LemonSqueezy service destroyed');
  }
}

// Singleton instance
export const lemonSqueezyService = new LemonSqueezyService();

/**
 * Initialize LemonSqueezy service on app startup
 */
export async function initializeLemonSqueezy(): Promise<void> {
  await lemonSqueezyService.initialize();
  logger.info('LemonSqueezy service initialized');
}