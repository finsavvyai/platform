# 🔐 Environment Variables Setup Guide

**IMPORTANT**: Before deploying to production, you must replace all placeholder values with real API keys and secrets.

## 📋 Required Accounts & API Keys

### 1. 🗄️ Database - Supabase (FREE)

**What you need**: PostgreSQL database connection string

**How to get it**:
1. Go to [supabase.com](https://supabase.com)
2. Click "Start your project" → Sign up
3. Create new project (takes ~2 minutes)
4. Go to **Settings** → **Database**
5. Copy the connection string from "Connection string" section
6. It looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres`

**Environment variable**:
```bash
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.PROJECT_ID.supabase.co:5432/postgres
```

---

### 2. 🔑 JWT Secrets (Generate Locally)

**What you need**: Two random 32-character strings for JWT tokens

**How to generate**:
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate refresh secret (run again for different value)
openssl rand -base64 32
```

**Environment variables**:
```bash
JWT_SECRET=your_generated_32_char_string_here
JWT_REFRESH_SECRET=different_32_char_string_here
```

---

### 3. 📧 Email Service (Choose ONE)

#### Option A: Gmail SMTP (Easiest for testing)

**How to set up**:
1. Use your existing Gmail account
2. Enable 2-factor authentication on your Google account
3. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
4. Generate an app password for "Mail"
5. Use this app password (not your regular Gmail password)

**Environment variables**:
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your_16_digit_app_password
FROM_EMAIL=noreply@questro.io
SUPPORT_EMAIL=support@questro.io
```

#### Option B: SendGrid (Recommended for production)

**How to set up**:
1. Go to [sendgrid.com](https://sendgrid.com) → Sign up (free tier: 100 emails/day)
2. Go to **Settings** → **API Keys**
3. Click "Create API Key" → Full Access
4. Copy the API key (starts with `SG.`)

**Environment variables**:
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
FROM_EMAIL=noreply@questro.io
SUPPORT_EMAIL=support@questro.io
```

---

### 4. 🍋 LemonSqueezy Payments

**How to set up**:
1. Go to [lemonsqueezy.com](https://lemonsqueezy.com) → Sign up
2. Create a new store
3. Get API credentials:
   - Go to **Settings** → **API**
   - Copy your API key
   - Note your Store ID from the URL or dashboard

**Environment variables**:
```bash
LEMONSQUEEZY_API_KEY=your_api_key_from_settings
LEMONSQUEEZY_STORE_ID=your_store_id_number
LEMONSQUEEZY_WEBHOOK_SECRET=create_random_string_for_webhooks
```

**Create Products**:
1. Go to **Products** → **Add Product**
2. Create "Pro Plan" - $29/month subscription
3. Create "Enterprise Plan" - $99/month subscription
4. Copy the variant IDs from each product

```bash
LEMONSQUEEZY_VARIANT_ID_PRO=variant_id_from_pro_product
LEMONSQUEEZY_VARIANT_ID_ENTERPRISE=variant_id_from_enterprise_product
```

---

### 5. 🧠 OpenAI (AI Test Generation)

**How to set up**:
1. Go to [platform.openai.com](https://platform.openai.com) → Sign up
2. Add billing information (minimum $5 credit)
3. Go to **API Keys** → "Create new secret key"
4. Copy the key (starts with `sk-`)

**Environment variables**:
```bash
OPENAI_API_KEY=sk-your_openai_api_key_here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.3
```

---

## 🚀 Quick Setup Commands

### Generate JWT Secrets
```bash
echo "JWT_SECRET=$(openssl rand -base64 32)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 32)"
```

### Test Email Configuration
```bash
# Test with curl after setting up
curl -X POST http://localhost:8000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@gmail.com","subject":"Test","message":"Testing Questro email"}'
```

### Verify Environment Variables
```bash
# Check all required variables are set (run from backend directory)
node -e "
const required = ['DATABASE_URL', 'JWT_SECRET', 'OPENAI_API_KEY', 'LEMONSQUEEZY_API_KEY'];
const missing = required.filter(key => !process.env[key] || process.env[key].includes('REPLACE'));
if (missing.length) {
  console.log('❌ Missing or placeholder values:', missing);
} else {
  console.log('✅ All required environment variables configured');
}
"
```

---

## 📝 Environment File Templates

### Development (.env)
```bash
# Use the existing .env for development with mock services
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/questro_dev
OPENAI_API_KEY=sk-test-key-for-development
# ... (mock values for development)
```

### Production (.env.production)
```bash
# Copy .env.production and replace all REPLACE_WITH_* values
NODE_ENV=production
DATABASE_URL=postgresql://postgres:real_password@db.project.supabase.co:5432/postgres
OPENAI_API_KEY=sk-real_api_key_here
# ... (all real values)
```

---

## ⚠️ Security Best Practices

### 1. Never commit real API keys to git
```bash
# Add to .gitignore (already done)
.env.production
.env.local
*.env.local
```

### 2. Use different keys for different environments
- Development: Mock/test keys
- Production: Real API keys with proper permissions

### 3. Rotate keys regularly
- Change JWT secrets monthly
- Rotate API keys quarterly
- Monitor for unusual usage

### 4. Use environment-specific settings
```bash
# Development - relaxed settings
RATE_LIMIT_MAX=1000
LOG_LEVEL=debug

# Production - strict settings  
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

---

## 🧪 Testing Your Configuration

### 1. Database Connection
```bash
# Test database connection
npm run db:test-connection
```

### 2. Email Sending
```bash
# Send test email
npm run test:email
```

### 3. Payment Processing
```bash
# Test LemonSqueezy webhooks
npm run test:payments
```

### 4. AI Generation
```bash
# Test OpenAI integration
curl -X POST http://localhost:8000/api/ai/generate-test \
  -H "Content-Type: application/json" \
  -d '{"description":"test login form","framework":"playwright"}'
```

---

## 💰 Cost Breakdown

| Service | Free Tier | Paid Plans | Monthly Cost |
|---------|-----------|------------|--------------|
| Supabase | 500MB DB, 2GB bandwidth | $25/month for Pro | $0-25 |
| SendGrid | 100 emails/day | $15/month for 40K emails | $0-15 |
| OpenAI | $5 minimum credit | Pay per usage | $5-50 |
| LemonSqueezy | No monthly fee | 5% transaction fee | $0 + 5% |
| **Total** | **$5-10/month** | **$45-90/month** | **Scales with usage** |

---

## 🚨 Common Issues & Solutions

### Database Connection Fails
```bash
# Check connection string format
# Should be: postgresql://user:pass@host:port/database
# Supabase format: postgresql://postgres:password@db.project.supabase.co:5432/postgres
```

### Email Not Sending
```bash
# Gmail: Make sure 2FA is enabled and you're using app password
# SendGrid: Check API key has full permissions
# Test with: curl -X POST localhost:8000/api/test-email
```

### Payment Webhooks Not Working
```bash
# LemonSqueezy webhook URL should be: https://api.questro.io/api/webhooks/lemonsqueezy
# Make sure LEMONSQUEEZY_WEBHOOK_SECRET matches in both places
```

### AI Generation Errors
```bash
# Check OpenAI billing has sufficient credits
# Verify API key starts with 'sk-' and is not expired
# Test with simple request first
```

---

## ✅ Pre-Deployment Checklist

- [ ] Database connection string configured and tested
- [ ] JWT secrets generated (32+ characters each)
- [ ] Email service configured and sending test emails
- [ ] LemonSqueezy products created with correct variant IDs
- [ ] OpenAI API key configured with sufficient credits
- [ ] All environment variables use real values (no REPLACE_WITH_*)
- [ ] Domain purchased and DNS configured
- [ ] SSL certificates ready for automatic provisioning

---

**Once all environment variables are properly configured with real values, you're ready to deploy to production!** 🚀