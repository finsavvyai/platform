# Lemon Squeezy & SendGrid Integration Guide for qestro Platform

## 🚀 Overview

This guide explains how to integrate Lemon Squeezy for payment processing and SendGrid for email communications in the qestro platform. Based on proven patterns from autoboot and coderail.dev reference implementations.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Lemon Squeezy Setup](#lemon-squeezy-setup)
3. [SendGrid Setup](#sendgrid-setup)
4. [Environment Configuration](#environment-configuration)
5. [Product Configuration](#product-configuration)
6. [Frontend Integration](#frontend-integration)
7. [Backend Integration](#backend-integration)
8. [Webhook Configuration](#webhook-configuration)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

- Lemon Squeezy account
- SendGrid account
- qestro platform deployed
- Access to DNS settings for webhook configuration

## 🍋 Lemon Squeezy Setup

### 1. Create Lemon Squeezy Account

1. Go to [Lemon Squeezy](https://lemonsqueezy.com)
2. Sign up for an account
3. Create a new store (e.g., "qestro Testing Platform")

### 2. Configure Store Settings

1. In Lemon Squeezy dashboard, go to Settings → General
2. Configure store currency: USD
3. Set store timezone
4. Configure tax collection (recommended)

### 3. Create Products

Using the `qs-` prefix for shared store compatibility:

#### Free Plan
- **Name**: `qs-qestro-free`
- **Type**: Free
- **Price**: $0
- **Description**: Free tier for individuals and small projects

#### Professional Plan (Monthly)
- **Name**: `qs-qestro-professional-monthly`
- **Type**: Subscription
- **Price**: $99/month
- **Description**: Professional test automation platform

#### Enterprise Plan (Monthly)
- **Name**: `qs-qestro-enterprise-monthly`
- **Type**: Subscription
- **Price**: $299/month
- **Description**: Enterprise-grade test automation

#### Early Access (One-time)
- **Name**: `qs-qestro-early-access-lifetime`
- **Type**: One-time purchase
- **Price**: $499
- **Description**: Lifetime access for early adopters

### 4. Get API Credentials

1. Go to Settings → API Keys
2. Create a new API key with "Full Access"
3. Note the API key (starts with `lmsq_sk_`)
4. Go to Settings → Webhooks
5. Create webhook endpoint: `https://qestro.app/api/webhooks/lemonsqueezy`
6. Select events: All subscription and order events
7. Note the webhook signing secret

## 📧 SendGrid Setup

### 1. Create SendGrid Account

1. Go to [SendGrid](https://sendgrid.com)
2. Sign up for a free account (100 emails/day)
3. Verify your account

### 2. Authenticate Your Domain

1. Go to Settings → Sender Authentication
2. Add and authenticate your domain: `qestro.io`
3. Set up DNS records (SPF, DKIM, DMARC)
4. This improves deliverability and removes "via sendgrid.net"

### 3. Create Email Templates

1. Go to Marketing → Email Templates
2. Create the following templates:

#### Welcome Template (ID: `d-welcome-template`)
- Subject: Welcome to qestro - Your AI-Powered Testing Platform! 🚀
- Dynamic Data: `user_name`, `login_url`, `support_email`

#### Subscription Templates
- **Created** (ID: `d-subscription-created`)
- **Updated** (ID: `d-subscription-updated`)
- **Cancelled** (ID: `d-subscription-cancelled`)
- **Expired** (ID: `d-subscription-expired`)
- **Payment Failed** (ID: `d-payment-failed`)

#### Authentication Templates
- **Email Verification** (ID: `d-email-verification`)
- **Password Reset** (ID: `d-password-reset`)

### 4. Get API Key

1. Go to Settings → API Keys
2. Create a new API key with "Full Access"
3. Note the API key (starts with `SG.`)

## ⚙️ Environment Configuration

### Backend Environment Variables

Add these to your backend `.env` file:

```bash
# Lemon Squeezy Configuration
LEMONSQUEEZY_API_KEY=lmsq_sk_your_api_key_here
LEMONSQUEEZY_STORE_ID=your_store_id_here
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret_here

# SendGrid Configuration
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@qestro.io
SENDGRID_FROM_NAME=qestro
SENDGRID_REPLY_TO_EMAIL=support@qestro.io

# Database Configuration
DATABASE_URL=postgresql://your_database_url
```

### Frontend Environment Variables

Add these to your frontend `.env` file:

```bash
# Lemon Squeezy Frontend Configuration
VITE_LEMONSQUEEZY_STORE_ID=your_store_id_here
VITE_LEMONSQUEEZY_FREE_VARIANT_ID=
VITE_LEMONSQUEEZY_PRO_VARIANT_ID=qs-qestro-professional-monthly
VITE_LEMONSQUEEZY_ENTERPRISE_VARIANT_ID=qs-qestro-enterprise-monthly
VITE_LEMONSQUEEZY_EARLY_ACCESS_VARIANT_ID=qs-qestro-early-access-lifetime
```

## 📊 Product Configuration

### Product Features and Limits

#### Free Tier
```typescript
{
  price: 0,
  features: [
    '100 tests per month',
    '1 project',
    'Basic recording features',
    'Community support',
    'Mobile testing (iOS/Android)',
    'Web testing (Playwright)',
    'AI test generation (limited)'
  ],
  limits: {
    tests: 100,
    projects: 1,
    teamMembers: 1,
    apiCalls: 1000
  }
}
```

#### Professional Tier
```typescript
{
  price: 99,
  features: [
    'Unlimited tests',
    '10 projects',
    'Advanced AI test generation',
    'Priority support',
    'Advanced analytics',
    'API testing',
    'Database testing',
    'Voice testing',
    'Custom integrations',
    'Collaboration features'
  ],
  limits: {
    tests: -1, // unlimited
    projects: 10,
    teamMembers: 5,
    apiCalls: 10000
  }
}
```

#### Enterprise Tier
```typescript
{
  price: 299,
  features: [
    'Everything in Professional',
    'Unlimited projects',
    'Unlimited team members',
    'Advanced security features',
    'SSO integration',
    'Custom framework support',
    'Dedicated support manager',
    'SLA guarantees',
    'On-premises deployment option',
    'Custom training sessions'
  ],
  limits: {
    tests: -1, // unlimited
    projects: -1, // unlimited
    teamMembers: -1, // unlimited
    apiCalls: 100000
  }
}
```

## 🎨 Frontend Integration

### 1. Install Dependencies

```bash
npm install @lemonsqueezy/lemonsqueezy.js
```

### 2. Import the Service

```typescript
import {
  LEMON_SQUEEZY_CONFIG,
  createCheckoutUrl,
  initializeLemonSqueezy,
  openCheckout,
  getProduct,
  getAllProducts,
  formatPrice
} from '@/services/LemonSqueezyService';
```

### 3. Use in Pricing Component

```typescript
import React, { useState } from 'react';
import { openCheckout, validateCheckoutOptions } from '@/services/LemonSqueezyService';

export default function PricingSection() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSubscribe = async (plan: keyof typeof LEMON_SQUEEZY_CONFIG.products) => {
    const options = {
      userEmail: 'user@example.com',
      userName: 'John Doe',
      userId: 'user123',
      customData: {
        source: 'pricing_page',
        utm_campaign: 'spring_launch'
      }
    };

    const validation = validateCheckoutOptions(options);
    if (!validation.valid) {
      alert('Please enter a valid email address');
      return;
    }

    setLoading(plan);
    try {
      await openCheckout(plan, options);
    } catch (error) {
      console.error('Checkout failed:', error);
      alert('Unable to open checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="pricing-grid">
      {Object.entries(LEMON_SQUEEZY_CONFIG.products).map(([key, product]) => (
        <div key={key} className="pricing-card">
          <h3>{product.name.replace('qs-qestro-', '').replace('-', ' ')}</h3>
          <div className="price">
            {formatPrice(product.price)}
            {product.type === 'subscription' && <span>/month</span>}
          </div>
          <ul className="features">
            {product.features.map(feature => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <button
            onClick={() => handleSubscribe(key as any)}
            disabled={loading === key}
            className="btn-primary"
          >
            {loading === key ? 'Loading...' : 'Get Started'}
          </button>
        </div>
      ))}
    </div>
  );
}
```

## 🖥️ Backend Integration

### 1. Update App Configuration

```typescript
// src/app.ts
import express from 'express';
import { LemonSqueezyService } from './services/LemonSqueezyService';
import { SendGridService } from './services/SendGridService';

const app = express();

// Initialize services
const lemonSqueezyService = new LemonSqueezyService();
const sendGridService = new SendGridService({
  apiKey: process.env.SENDGRID_API_KEY!,
  fromEmail: process.env.SENDGRID_FROM_EMAIL!,
  fromName: 'qestro'
});

// Make services available globally
app.locals.lemonSqueezy = lemonSqueezyService;
app.locals.emailService = sendGridService;
```

### 2. Add Webhook Routes

```typescript
// src/routes/webhooks.ts
import express from 'express';
import lemonsqueezyWebhooks from './webhooks/lemonsqueezy';

const router = express.Router();

// Use raw body parser for webhooks
router.use('/lemonsqueezy', express.raw({ type: 'application/json' }), lemonsqueezyWebhooks);

export default router;
```

### 3. Add Payment Routes

```typescript
// src/routes/payments.ts
import express from 'express';
import { LemonSqueezyService } from '../services/LemonSqueezyService';

const router = express.Router();
const lemonSqueezy = new LemonSqueezyService();

// Create checkout session
router.post('/checkout', async (req, res) => {
  try {
    const { variantId, userEmail, userName, customData } = req.body;

    const checkout = await lemonSqueezy.createCheckout(variantId, {
      email: userEmail,
      name: userName,
      customData
    });

    res.json({ success: true, checkout });
  } catch (error) {
    console.error('Checkout creation failed:', error);
    res.status(500).json({ error: 'Checkout creation failed' });
  }
});

// Get pricing information
router.get('/pricing', async (req, res) => {
  try {
    const products = await lemonSqueezy.getProducts();
    res.json({ success: true, products });
  } catch (error) {
    console.error('Failed to get products:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

export default router;
```

## 🔗 Webhook Configuration

### 1. Configure Webhook URL

In Lemon Squeezy dashboard:
1. Go to Settings → Webhooks
2. Add webhook endpoint: `https://qestro.app/api/webhooks/lemonsqueezy`
3. Select events:
   - `order_created`
   - `order_refunded`
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_resumed`
   - `subscription_expired`
   - `subscription_payment_success`
   - `subscription_payment_failed`

### 2. Test Webhook

```bash
# Test webhook locally
curl -X POST http://localhost:3000/api/webhooks/lemonsqueezy \
  -H "Content-Type: application/json" \
  -H "x-lemonsqueezy-signature: test_signature" \
  -d '{
    "meta": {
      "event_name": "order_created",
      "custom_data": {
        "test": true
      }
    },
    "data": {
      "id": "test_order_id",
      "type": "orders",
      "attributes": {
        "customer_email": "test@example.com",
        "total": 99.00,
        "currency": "USD"
      }
    }
  }'
```

## 🧪 Testing

### 1. Test Email Service

```typescript
import { sendGridService } from './services/SendGridService';

// Test email configuration
const testResult = await sendGridService.testConfiguration('test@example.com');
console.log('Email test result:', testResult);
```

### 2. Test Lemon Squeezy Integration

```typescript
import { LemonSqueezyService } from './services/LemonSqueezyService';

const lemonSqueezy = new LemonSqueezyService();

// Test checkout creation
const checkout = await lemonSqueezy.createCheckout('variant_id', {
  email: 'test@example.com',
  name: 'Test User',
  customData: { test: true }
});

console.log('Checkout URL:', checkout.checkoutUrl);
```

### 3. Test Frontend Integration

```typescript
// In browser console
import { openCheckout } from '@/services/LemonSqueezy';

// Test checkout
await openCheckout('professional', {
  userEmail: 'test@example.com',
  userName: 'Test User'
});
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Webhook Signature Verification Failed

**Problem**: Invalid webhook signature
**Solution**:
- Verify the webhook secret matches exactly
- Check that the payload is raw JSON (not parsed)
- Ensure no extra whitespace in the signature

#### 2. Email Not Sending

**Problem**: SendGrid emails not being delivered
**Solution**:
- Verify API key is correct and has proper permissions
- Check that sender domain is authenticated
- Verify email templates exist and are active
- Check spam folder and sender reputation

#### 3. Checkout Not Loading

**Problem**: Lemon Squeezy checkout not opening
**Solution**:
- Verify store ID is correct
- Check that variant IDs match
- Ensure Lemon Squeezy script is loaded
- Check browser console for JavaScript errors

#### 4. Product Not Found

**Problem**: Product variant not found
**Solution**:
- Verify product exists in Lemon Squeezy dashboard
- Check variant ID spelling
- Ensure product is published and active

### Debug Mode

Enable debug logging:

```typescript
// Frontend
if (import.meta.env.DEV) {
  console.log('🔍 Lemon Squeezy Debug:', LEMON_SQUEEZY_CONFIG);
}

// Backend
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 Debug mode enabled');
}
```

### Monitoring

#### Key Metrics to Monitor
- Checkout conversion rate
- Subscription churn rate
- Email delivery rate
- Payment success rate
- Webhook processing errors

#### Alerting
Set up alerts for:
- Payment failures
- Email delivery failures
- Webhook processing errors
- High subscription cancellation rates

## 📚 Additional Resources

- [Lemon Squeezy Documentation](https://docs.lemonsqueezy.com/)
- [SendGrid Documentation](https://docs.sendgrid.com/)
- [qestro Platform Architecture](./PLATFORM_ARCHITECTURE.md)
- [Reference Implementation: autoboot](../mcp-agents/autoboot/)
- [Reference Implementation: coderail.dev](../github/coderail.dev/)

## 🚀 Next Steps

1. ✅ Set up Lemon Squeezy account and products
2. ✅ Configure SendGrid and email templates
3. ✅ Add environment variables
4. ✅ Test frontend integration
5. ✅ Test backend webhook handlers
6. ✅ Deploy to production
7. 📊 Monitor performance and metrics
8. 🔄 Iterate based on user feedback

---

**This integration provides qestro with enterprise-grade payment processing and email communications, following proven patterns from successful SaaS platforms.**