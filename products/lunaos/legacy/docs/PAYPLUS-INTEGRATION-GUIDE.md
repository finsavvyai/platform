# 💳 LunaForge PayPlus Payment Integration Guide

## Overview

LunaForge integrates with **PayPlus** to provide seamless payment processing for premium features. This guide covers the complete payment system implementation, configuration, and usage.

---

## 🏗️ **Architecture Overview**

### **Payment System Components**
```
LunaForge Payment System
├── PayPlusManager.ts        # Core payment processing logic
├── PaymentUI.ts            # User interface components
├── Extension Integration   # VS Code extension integration
├── Configuration System    # PayPlus API configuration
└── Webhook Handlers       # Payment event processing
```

### **Payment Flow**
1. **User Selection**: User chooses subscription plan
2. **Payment Session**: PayPlus creates secure payment session
3. **Browser Payment**: User completes payment in external browser
4. **Webhook Processing**: PayPlus notifies LunaForge of payment status
5. **Feature Unlock**: Premium features are activated immediately

---

## 💎 **Subscription Plans**

### **🔥 Free Tier - $0/month**
- **Up to 1,000 files** per project
- **1 analysis per day**
- Basic visualization features
- Community support

### **🚀 Professional - $29/month** ($290/year)
- **Unlimited project size** (up to 10,000 files)
- **All 12 analysis modes** unlocked
- **AI-powered recommendations**
- **Advanced export options** (JSON, DOT, SVG, CSV)
- **Priority email support** (24-hour response)
- **Unlimited daily analyses**

### **🏢 Enterprise - $99/month** ($990/year)
- **Everything in Professional**
- **Team collaboration** (up to 25 users)
- **Advanced security features**
- **API access** for integrations
- **Dedicated Slack support**
- **Onboarding and training session**
- **Custom reporting and analytics**
- **SSO integration**

---

## 🔧 **Configuration**

### **Environment Variables**
```bash
# PayPlus API Configuration
export PAYPLUS_API_KEY="your-production-api-key"
export PAYPLUS_MERCHANT_ID="your-merchant-id"
export PAYPLUS_SECRET_KEY="your-secret-key"
```

### **VS Code Settings**
```json
{
  "lunaforge.payPlusApiKey": "your-api-key",
  "lunaforge.payPlusEnvironment": "production",
  "lunaforge.payPlusMerchantId": "your-merchant-id",
  "lunaforge.payPlusSecretKey": "your-secret-key"
}
```

### **Development vs Production**
```typescript
// Sandbox (Testing)
const payPlusConfig: PayPlusConfig = {
  apiKey: "sandbox-api-key",
  environment: "sandbox",
  merchantId: "test-merchant-id",
  secretKey: "test-secret-key"
};

// Production (Live Payments)
const payPlusConfig: PayPlusConfig = {
  apiKey: "production-api-key",
  environment: "production",
  merchantId: "live-merchant-id",
  secretKey: "live-secret-key"
};
```

---

## 🎯 **Implementation Details**

### **PayPlusManager Class**
```typescript
class PayPlusManager {
  // Create payment session
  async createSubscriptionPayment(planId: string): Promise<PaymentResult>

  // Check subscription status
  async getSubscriptionStatus(): Promise<SubscriptionStatus>

  // Cancel subscription
  async cancelSubscription(): Promise<PaymentResult>

  // Show upgrade prompt
  async showUpgradePrompt(feature: string): Promise<void>

  // Check premium access
  async hasPremiumAccess(): Promise<boolean>

  // Get usage limits
  async getUsageLimits(): Promise<UsageLimits>
}
```

### **PaymentUI Class**
```typescript
class PaymentUI {
  // Show upgrade dialog
  async upgradeSubscription(): Promise<void>

  // View subscription status
  async viewSubscription(): Promise<void>

  // Manage billing settings
  async manageBilling(): Promise<void>

  // View pricing plans
  async viewPricing(): Promise<void>

  // Show usage limit warnings
  async showUsageLimitWarning(type: 'files' | 'analyses'): Promise<void>
}
```

---

## 🚀 **Usage Examples**

### **Checking Premium Access**
```typescript
// Check if user has premium features
const payPlusManager = PayPlusManager.getInstance(config);
const hasPremium = await payPlusManager.hasPremiumAccess();

if (!hasPremium) {
  await payPlusManager.showUpgradePrompt('Advanced Analysis');
  return;
}

// Execute premium feature
executeAdvancedAnalysis();
```

### **Usage Limits**
```typescript
// Get current usage limits
const limits = await payPlusManager.getUsageLimits();

if (currentFiles > limits.maxFiles) {
  await paymentUI.showUsageLimitWarning('files');
  return;
}

if (dailyAnalyses >= limits.maxAnalysesPerDay) {
  await paymentUI.showUsageLimitWarning('analyses');
  return;
}
```

### **Command Palette Integration**
```typescript
// Register payment commands
vscode.commands.registerCommand('lunaforge.upgradeSubscription', () => {
  paymentUI.upgradeSubscription();
});

vscode.commands.registerCommand('lunaforge.viewSubscription', () => {
  paymentUI.viewSubscription();
});
```

---

## 🔄 **Webhook Integration**

### **Payment Success Webhook**
```typescript
// POST https://api.lunaos.ai/webhooks/payment-success
{
  "event": "payment.completed",
  "transaction_id": "txn_1234567890",
  "subscription_id": "sub_1234567890",
  "plan_id": "lunaforge-professional-monthly",
  "customer_email": "user@example.com",
  "amount": 2900,
  "currency": "USD"
}
```

### **Subscription Created Webhook**
```typescript
// POST https://api.lunaos.ai/webhooks/subscription-created
{
  "event": "subscription.created",
  "subscription_id": "sub_1234567890",
  "plan_id": "lunaforge-professional-monthly",
  "status": "active",
  "customer_email": "user@example.com",
  "starts_at": "2024-01-01T00:00:00Z",
  "ends_at": "2024-02-01T00:00:00Z"
}
```

---

## 🛡️ **Security Implementation**

### **Payment Security**
- **PCI Compliance**: All payment processing handled by PayPlus
- **Tokenization**: Credit card data never stored in LunaForge
- **Secure Sessions**: Temporary payment tokens with limited lifespan
- **HTTPS Only**: All communication encrypted end-to-end
- **Webhook Validation**: Verify PayPlus webhook signatures

### **Data Protection**
```typescript
// Secure payment session creation
const payload = {
  merchant_id: config.merchantId,
  session_id: generateSecureSessionId(),
  amount: plan.price * 100, // Convert to cents
  currency: plan.currency,
  success_url: 'vscode://lunaforge.payment.success',
  cancel_url: 'vscode://lunaforge.payment.cancel',
  webhooks: {
    payment_success: 'https://api.lunaos.ai/webhooks/payment-success',
    subscription_created: 'https://api.lunaos.ai/webhooks/subscription-created'
  }
};

// Sign webhook requests
const signature = crypto
  .createHmac('sha256', config.secretKey)
  .update(JSON.stringify(payload))
  .digest('hex');
```

---

## 📊 **Analytics and Tracking**

### **Payment Events**
```typescript
// Track payment attempts
analytics.track('payment_attempt_started', {
  plan_id: planId,
  plan_name: plan.name,
  price: plan.price,
  source: 'vscode_extension'
});

// Track successful payments
analytics.track('payment_completed', {
  transaction_id: transactionId,
  plan_id: planId,
  amount: plan.price,
  conversion_time: conversionTime
});

// Track subscription upgrades
analytics.track('subscription_upgraded', {
  from_tier: previousTier,
  to_tier: newTier,
  upgrade_reason: upgradeReason
});
```

### **Usage Metrics**
```typescript
// Track premium feature usage
analytics.track('premium_feature_used', {
  feature: featureName,
  user_tier: userTier,
  usage_count: usageCount,
  session_duration: sessionDuration
});
```

---

## 🎨 **User Experience**

### **Status Bar Integration**
- **Free Users**: `$(star-empty) LunaForge Free`
- **Professional**: `$(star-full) LunaForge Pro`
- **Enterprise**: `$(star-full) LunaForge Enterprise`

### **Upgrade Prompts**
```typescript
// Smart upgrade prompts based on usage
if (filesAnalyzed > 800 && currentPlan === 'free') {
  await payPlusManager.showUpgradePrompt(
    'You\'re approaching the 1,000 file limit. Upgrade to Professional for unlimited files!'
  );
}
```

### **Payment Success Flow**
1. **Immediate Confirmation**: Show success message in VS Code
2. **Feature Unlock**: Enable premium features instantly
3. **Welcome Email**: Send welcome email with getting started guide
4. **Status Update**: Update status bar with new subscription status

---

## 🧪 **Testing**

### **Sandbox Testing**
```typescript
// Use PayPlus sandbox for testing
const testConfig: PayPlusConfig = {
  apiKey: "sb_test_api_key",
  environment: "sandbox",
  merchantId: "sb_test_merchant",
  secretKey: "sb_test_secret"
};

// Test payment flow
const result = await payPlusManager.createSubscriptionPayment('lunaforge-professional-monthly');
console.log('Test payment session:', result);
```

### **Mock Payment Scenarios**
```typescript
// Mock successful payment
const mockPaymentResult: PaymentResult = {
  success: true,
  transactionId: 'test_txn_123',
  subscriptionId: 'test_sub_123',
  plan: testPlan
};

// Test upgrade prompt
await paymentUI.showPaymentSuccess(testPlan);
```

---

## 🚀 **Deployment**

### **Production Checklist**
- [ ] PayPlus production API keys configured
- [ ] Webhook endpoints deployed and tested
- [ ] SSL certificates installed
- [ ] Error monitoring implemented
- [ ] Payment analytics configured
- [ ] Customer support processes ready

### **Environment Variables**
```bash
# Production
PAYPLUS_API_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx
PAYPLUS_ENVIRONMENT=production
PAYPLUS_MERCHANT_ID=live_merchant_xxxxxxxxxx
PAYPLUS_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx

# Webhook Security
WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
WEBHOOK_URL=https://api.lunaos.ai/webhooks/payplus
```

---

## 📞 **Support and Troubleshooting**

### **Common Issues**
1. **Payment Session Creation Failed**
   - Check API credentials
   - Verify PayPlus environment settings
   - Confirm merchant account status

2. **Webhook Not Received**
   - Verify webhook URL is accessible
   - Check webhook secret configuration
   - Review PayPlus webhook logs

3. **Features Not Unlocking**
   - Verify subscription status in database
   - Check user's VS Code configuration
   - Restart VS Code extension

### **Customer Support**
- **Payment Issues**: billing@lunaos.ai
- **Technical Support**: support@lunaos.ai
- **Documentation**: https://lunaos.ai/docs/payments

---

## 📈 **Revenue Analytics**

### **Key Metrics**
- **Conversion Rate**: Free → Premium (target: 5-10%)
- **Revenue Per User**: Average monthly revenue per active user
- **Churn Rate**: Monthly subscription cancellations
- **Lifetime Value**: Total revenue per customer over lifetime

### **Analytics Dashboard**
Real-time monitoring of:
- Daily signups and upgrades
- Revenue by plan tier
- Payment success rates
- Feature usage by subscription level
- Customer satisfaction scores

---

## 🎯 **Future Enhancements**

### **Planned Features**
- **Annual Billing Discounts**: Save 17% with yearly plans
- **Team Management**: Multi-seat licenses for organizations
- **Custom Plans**: Tailored solutions for large enterprises
- **International Payments**: Support for multiple currencies
- **Corporate Billing**: Purchase orders and invoicing

### **Integration Roadmap**
- **Slack Bot**: Subscription management via Slack
- **API Access**: Public API for integration partners
- **Mobile App**: Subscription management on mobile devices
- **CRM Integration**: Customer support and billing automation

---

## 💳 **Conclusion**

The LunaForge PayPlus integration provides a comprehensive, secure, and user-friendly payment system that enables:

✅ **Seamless Upgrade Flow** from free to premium tiers
✅ **Enterprise-Grade Security** with PayPlus PCI compliance
✅ **Professional User Experience** with intuitive payment UI
✅ **Advanced Analytics** for revenue optimization
✅ **Scalable Architecture** ready for future growth

The payment system is production-ready and handles all aspects of subscription management, from initial signup through ongoing billing and customer support.

🌙 **LunaForge + PayPlus = Professional Payment Processing Made Easy** 🚀