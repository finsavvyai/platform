# 📧 Email Service Setup Guide - qestro Platform

## 🚀 Overview

The qestro platform now uses a robust multi-provider email service adapted from the proven autoboot architecture. This service provides automatic fallbacks between providers to ensure high deliverability rates.

## 📋 Supported Email Providers

### 1. **SendGrid** (Primary Provider)
- **API Key**: Required
- **Templates**: Dynamic template support
- **Fallback**: HTTP API if library unavailable

### 2. **Resend** (Secondary Provider)
- **API Key**: Required
- **Simple API**: Clean, modern email API
- **Good for**: Transactional emails

### 3. **Mailgun** (Tertiary Provider)
- **API Key**: Required
- **Domain**: Required
- **Form Data**: Traditional form-based API

### 4. **SMTP** (Fallback Provider)
- **Host**: Required
- **Port**: Default 587
- **Authentication**: User/Password optional

## 🔧 Environment Configuration

Add these environment variables to your `.env` file:

```bash
# === Email Service Configuration ===
# Primary email sender address
FROM_EMAIL=noreply@qestro.io
SUPPORT_EMAIL=support@qestro.io
BILLING_EMAIL=billing@qestro.io

# === SendGrid Configuration ===
# Get from: https://app.sendgrid.com/settings/api_keys
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here

# SendGrid Template IDs (optional - for dynamic templates)
SENDGRID_TEMPLATE_WELCOME=d-your-welcome-template
SENDGRID_TEMPLATE_PAYMENT=d-your-payment-template
SENDGRID_TEMPLATE_CANCELLED=d-your-cancelled-template
SENDGRID_TEMPLATE_TRIAL=d-your-trial-template
SENDGRID_TEMPLATE_FAILED=d-your-failed-template

# === Resend Configuration ===
# Get from: https://resend.com/api-keys
RESEND_API_KEY=re_your_resend_api_key_here

# === Mailgun Configuration ===
# Get from: https://app.mailgun.com/app/settings/api_security
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=mg.yourdomain.com

# === SMTP Configuration (Fallback) ===
# Use any SMTP server as backup
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# === Frontend URLs ===
# Used in email templates for links
FRONTEND_URL=https://qestro.io
```

## 🏗️ Service Architecture

### Multi-Provider Fallback System

```
1. SendGrid (Primary)
   ↓ If fails
2. Resend (Secondary)
   ↓ If fails
3. Mailgun (Tertiary)
   ↓ If fails
4. SMTP (Fallback)
   ↓ If fails
5. Console Log (Development)
```

### Email Templates Available

1. **Welcome Email** - `sendWelcomeEmail()`
   - Sent on new user registration and subscription activation
   - Includes plan details and getting started links

2. **Payment Confirmation** - `sendPaymentConfirmationEmail()`
   - Sent after successful payments
   - Includes order details and billing management links

3. **Subscription Cancelled** - `sendSubscriptionCancelledEmail()`
   - Sent when subscription is cancelled
   - Includes reactivation options and effective date

4. **Trial Ending Reminder** - `sendTrialEndingReminder()`
   - Sent X days before trial ends
   - Includes upgrade urgency and benefits

5. **Payment Failed** - `sendPaymentFailedEmail()`
   - Sent when payment fails
   - Includes retry date and update payment link

## 🧪 Testing the Email Service

### 1. Test Provider Verification

```javascript
import { emailService } from './backend/src/services/EmailService.js';

// Verify all configured providers
const results = await emailService.verifyAllProviders();
console.log('Provider Status:', results);
// Expected output: { sendgrid: true, resend: false, mailgun: true, smtp: true }
```

### 2. Test Welcome Email

```javascript
// Send a test welcome email
const result = await emailService.sendWelcomeEmail(
  'test@example.com',
  'Test User',
  'qs-qestro-professional-monthly'
);

console.log('Email result:', result);
// Expected: { success: true, provider: 'sendgrid', messageId: '...' }
```

### 3. Test Payment Confirmation

```javascript
// Send a test payment confirmation
const result = await emailService.sendPaymentConfirmationEmail(
  'test@example.com',
  'Test User',
  'qs-qestro-enterprise-monthly',
  'order_12345',
  4700, // $47.00 in cents
  'USD'
);

console.log('Payment email result:', result);
```

## 🔌 Integration Points

### 1. Lemon Squeezy Webhooks

The email service is integrated with Lemon Squeezy webhooks:

```typescript
// backend/src/routes/webhooks/lemonsqueezy.ts
import { emailService } from '../../services/EmailService.js';

// Automatic emails sent for:
- Order created → Welcome email
- Subscription created → Welcome email
- Subscription cancelled → Cancellation email
- Payment failed → Payment failed email
- Subscription updated → Payment confirmation
```

### 2. User Registration

```typescript
// Send welcome email when user signs up
await emailService.sendWelcomeEmail(email, name, 'free');
```

### 3. Plan Upgrades

```typescript
// Send confirmation when user upgrades plan
await emailService.sendPaymentConfirmationEmail(
  email,
  name,
  newPlan,
  orderId,
  amount,
  currency
);
```

## 📊 Plan Configuration

The service recognizes these plan identifiers:

### Shared Store Products (qs- prefix)
- `qs-qestro-free` → Free Plan
- `qs-qestro-professional-monthly` → Professional Plan
- `qs-qestro-enterprise-monthly` → Enterprise Plan

### Direct Plan Names
- `free` → Free Plan
- `professional` → Professional Plan
- `enterprise` → Enterprise Plan

## 🛠️ Development vs Production

### Development Mode
```bash
# Use console output for testing
EMAIL_PROVIDER=console
```

### Production Mode
```bash
# Configure real providers
SENDGRID_API_KEY=your_production_key
RESEND_API_KEY=your_production_key
```

## 🔍 Troubleshooting

### Common Issues

1. **No providers configured**
   - **Error**: "No email providers configured"
   - **Fix**: Add at least one provider's API keys to `.env`

2. **SendGrid library not available**
   - **Warning**: "SendGrid library not available, using fallback HTTP method"
   - **Fix**: Install `@sendgrid/mail` or ensure HTTP access works

3. **Template not found**
   - **Error**: SendGrid template errors
   - **Fix**: Create templates in SendGrid dashboard or remove template IDs

4. **SMTP authentication failed**
   - **Error**: SMTP authentication errors
   - **Fix**: Check SMTP credentials and use app passwords for Gmail

### Debug Mode

Enable detailed logging:

```bash
# Set log level to debug
LOG_LEVEL=debug

# Check service initialization
npm run dev:backend
```

### Provider Status Check

Create an endpoint to check provider health:

```typescript
// GET /api/email/status
export async function getEmailStatus(req, res) {
  const status = await emailService.verifyAllProviders();
  res.json({
    providers: status,
    configured: Object.keys(status).length > 0
  });
}
```

## 🚀 Quick Start

1. **Configure at least one provider** (SendGrid recommended)
2. **Set FROM_EMAIL and SUPPORT_EMAIL** environment variables
3. **Test with a welcome email**
4. **Verify webhook integration** with Lemon Squeezy
5. **Monitor logs** for deliverability issues

## 📈 Monitoring and Analytics

### Log Examples

```bash
# Successful email
INFO: Email sent successfully via sendgrid { to: "user@example.com", subject: "Welcome to qestro Professional!", messageId: "abc123" }

# Provider fallback
WARN: Provider sendgrid failed: API rate limit exceeded
INFO: Email sent successfully via resend { to: "user@example.com", subject: "Welcome to qestro Professional!" }

# All providers failed
ERROR: All email providers failed { to: "user@example.com", subject: "Welcome to qestro Professional!", lastError: "Network timeout" }
```

### Metrics to Track

- **Delivery Rate**: Success rate per provider
- **Fallback Usage**: How often secondary providers are used
- **Template Performance**: Open rates for different templates
- **Provider Uptime**: Availability of each email service

## 🔄 AutoBoot Integration Benefits

By using the proven autoboot email service architecture:

✅ **High Deliverability** - Automatic fallbacks ensure emails get delivered
✅ **Cost Optimization** - Use cheaper providers when possible
✅ **Template Management** - Dynamic template support for personalization
✅ **Error Handling** - Comprehensive error tracking and retry logic
✅ **Scalability** - Handles bulk emails and high volume
✅ **Maintenance** - Easy to add/remove providers without code changes

---

**Ready to start sending emails? Configure your providers and test the welcome email! 🎉**