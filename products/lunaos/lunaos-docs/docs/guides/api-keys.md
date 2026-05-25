# API Key Authentication Setup

## 🔐 Overview

Luna Agents uses API keys to gate access to premium features like Luna Vision RAG™. This system ensures only paying customers can access Pro features.

---

## 🏗️ Architecture

```
User subscribes → LemonSqueezy → Webhook → Generate API Key → Store in KV → Email to user
User makes request → Validate API key → Check limits → Allow/Deny access
```

### Components

1. **API Auth Service** (`api-auth/`) - Cloudflare Worker for key validation
2. **Webhook Handler** (`webhooks/lemonsqueezy.js`) - Processes subscription events
3. **KV Store** - Stores API keys and usage data
4. **Luna Vision RAG MCP** - Validates keys before processing

---

## 📋 Setup Steps

### Step 1: Create KV Namespace

```bash
# Create KV namespace for API keys
cd api-auth
wrangler kv:namespace create "API_KEYS"

# Copy the ID that's returned
# Example: id = "abc123def456"
```

Update `api-auth/wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "API_KEYS"
id = "YOUR_KV_NAMESPACE_ID_HERE"  # Paste the ID from above
```

### Step 2: Set Webhook Secret

```bash
# Generate a random secret
openssl rand -hex 32

# Set it as a Cloudflare secret
cd api-auth
wrangler secret put WEBHOOK_SECRET
# Paste the generated secret when prompted
```

Save this secret - you'll need it for the webhook handler.

### Step 3: Deploy API Auth Service

```bash
cd api-auth
wrangler deploy
```

Your auth service will be live at:
- `https://luna-agents-api-auth.YOUR_SUBDOMAIN.workers.dev`
- Or custom domain: `https://auth.lunaos.ai`

### Step 4: Configure Custom Domain (Optional)

1. Go to Cloudflare Dashboard → Workers
2. Find `luna-agents-api-auth`
3. Click "Triggers" → "Custom Domains"
4. Add: `auth.lunaos.ai`
5. DNS configured automatically

### Step 5: Update Webhook Handler

Edit `webhooks/lemonsqueezy.js`:

```javascript
// Set these environment variables
process.env.AUTH_SERVICE_URL = 'https://auth.lunaos.ai';
process.env.WEBHOOK_SECRET = 'YOUR_WEBHOOK_SECRET_HERE';
process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 'FROM_LEMONSQUEEZY_DASHBOARD';
```

### Step 6: Configure LemonSqueezy Webhook

1. Go to LemonSqueezy Dashboard → Settings → Webhooks
2. Click "Add endpoint"
3. **URL**: `https://your-api.com/webhooks/lemonsqueezy`
4. **Secret**: Generate and save (use in webhook handler)
5. **Events**:
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_resumed`
   - `subscription_expired`
   - `subscription_payment_success`
   - `subscription_payment_failed`

---

## 🔑 API Key Format

API keys follow this format:
```
luna_AbCdEfGh1234567890IjKlMnOpQrSt
```

- Prefix: `luna_`
- Length: 37 characters total
- Characters: Alphanumeric (A-Z, a-z, 0-9)

---

## 📊 Usage Tracking

### Free Tier ($0)
- Commands: Unlimited (BYOK)
- Rate limit: 60 requests/min
- RAG: ❌ Not available
- Visual QA: ❌ Not available

### Pro Tier ($29/mo)
- Commands: Unlimited (managed keys)
- Rate limit: 600 requests/min
- 33 MCP servers
- RAG: ✅ Full access
- Visual QA: ✅ Full access

### Team Tier ($79/mo)
- Everything in Pro
- Rate limit: 6,000 requests/min
- Team workspace, SSO/SAML, shared memory, audit logs

---

## 🔌 API Endpoints

### Validate API Key

```bash
POST https://auth.lunaos.ai/validate
Content-Type: application/json

{
  "apiKey": "luna_AbCdEfGh1234567890IjKlMnOpQrSt"
}
```

**Response (Success)**:
```json
{
  "valid": true,
  "tier": "pro",
  "customerId": "123456",
  "usage": {
    "queries": {
      "used": 45,
      "limit": -1,
      "remaining": -1
    },
    "filesIndexed": {
      "used": 2500,
      "limit": -1,
      "remaining": -1
    }
  },
  "features": {
    "lunaVisionRAG": true,
    "unlimitedIndexing": true,
    "unlimitedQueries": true,
    "prioritySupport": true
  }
}
```

**Response (Invalid)**:
```json
{
  "valid": false,
  "error": "Invalid API key"
}
```

### Get Usage Statistics

```bash
GET https://auth.lunaos.ai/usage
Authorization: Bearer luna_AbCdEfGh1234567890IjKlMnOpQrSt
```

**Response**:
```json
{
  "tier": "pro",
  "usage": {
    "queries": 45,
    "filesIndexed": 2500,
    "screenshotsAnalyzed": 12
  },
  "limits": {
    "queries": -1,
    "filesIndexed": -1,
    "screenshotsAnalyzed": -1
  },
  "resetDate": "2024-01-02T00:00:00.000Z"
}
```

---

## 🔧 Integration with Luna Vision RAG MCP

Update `mcp-servers/luna-vision-rag-mcp/src/index.js`:

```javascript
// Add API key validation
async function validateAPIKey(apiKey) {
  const response = await fetch('https://auth.lunaos.ai/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey }),
  });
  
  return await response.json();
}

// In your MCP handler
export default {
  async fetch(request, env) {
    // Get API key from header
    const apiKey = request.headers.get('X-API-Key');
    
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'API key required. Get yours at https://agent.lunaos.ai/pricing'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Validate API key
    const validation = await validateAPIKey(apiKey);
    
    if (!validation.valid) {
      return new Response(JSON.stringify({
        error: validation.error || 'Invalid API key',
        upgrade: 'https://agent.lunaos.ai/pricing'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Check if user has access to Luna Vision RAG
    if (!validation.features.lunaVisionRAG) {
      return new Response(JSON.stringify({
        error: 'Luna Vision RAG™ requires Pro subscription',
        upgrade: 'https://agent.lunaos.ai/pricing'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Process request...
  }
};
```

---

## 👥 User Configuration

Users add their API key to their MCP configuration:

### Claude Desktop

```json
{
  "mcpServers": {
    "luna-vision-rag": {
      "url": "https://luna-vision-rag-mcp.broad-dew-49ad.workers.dev/mcp",
      "headers": {
        "X-API-Key": "luna_AbCdEfGh1234567890IjKlMnOpQrSt"
      }
    }
  }
}
```

### Zed

```json
{
  "context_servers": {
    "luna-vision-rag": {
      "settings": {
        "url": "https://luna-vision-rag-mcp.broad-dew-49ad.workers.dev/mcp",
        "headers": {
          "X-API-Key": "luna_AbCdEfGh1234567890IjKlMnOpQrSt"
        }
      }
    }
  }
}
```

---

## 📧 Email Templates

### Welcome Email (After Subscription)

```
Subject: Welcome to Luna Agents Pro! 🌙

Hi there,

Thanks for subscribing to Luna Agents Pro!

Your API Key:
luna_AbCdEfGh1234567890IjKlMnOpQrSt

Get Started:
1. Add your API key to your MCP configuration
2. Restart your AI coding assistant
3. Start using Luna Vision RAG™!

Documentation: https://agent.lunaos.ai/docs
Dashboard: https://agent.lunaos.ai/dashboard

Questions? Just reply to this email.

Happy coding!
The Luna Agents Team
```

### Cancellation Email

```
Subject: Your Luna Agents subscription

Hi there,

We're sorry to see you go!

Your subscription will remain active until: [END_DATE]
After that, you'll be downgraded to the Free tier.

Want to stay? You can reactivate anytime at:
https://agent.lunaos.ai/pricing

We'd love to hear your feedback:
[FEEDBACK_LINK]

Thanks for trying Luna Agents!
```

---

## 🧪 Testing

### Test API Key Generation

```bash
curl -X POST https://auth.lunaos.ai/generate \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "test_123",
    "email": "test@example.com",
    "tier": "pro",
    "subscriptionId": "sub_123"
  }'
```

### Test API Key Validation

```bash
curl -X POST https://auth.lunaos.ai/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "luna_YOUR_TEST_KEY_HERE"
  }'
```

### Test Usage Tracking

```bash
curl https://auth.lunaos.ai/usage \
  -H "Authorization: Bearer luna_YOUR_TEST_KEY_HERE"
```

---

## 🔒 Security Best Practices

1. **Never expose API keys** in client-side code
2. **Use HTTPS only** for all API calls
3. **Rotate webhook secrets** regularly
4. **Monitor for abuse** - track usage patterns
5. **Rate limit** validation endpoint
6. **Log all access** for audit trail

---

## 📊 Monitoring

### Key Metrics to Track

- API key validations per minute
- Failed validation attempts
- Usage by tier
- Top users by API calls
- Subscription churn rate

### Cloudflare Analytics

View in Cloudflare Dashboard:
- Workers → luna-agents-api-auth → Metrics
- Requests, errors, CPU time
- Set up alerts for errors

---

## 🚀 Deployment Checklist

- [ ] KV namespace created
- [ ] Webhook secret set
- [ ] API auth service deployed
- [ ] Custom domain configured (optional)
- [ ] Webhook handler deployed
- [ ] LemonSqueezy webhook configured
- [ ] Luna Vision RAG MCP updated with validation
- [ ] Email templates configured
- [ ] Test API key generated
- [ ] Test validation working
- [ ] Test webhook flow end-to-end
- [ ] Monitor logs for errors

---

## 💡 Next Steps

After API key system is live:

1. **Update Documentation** - Add API key setup instructions
2. **Create Dashboard** - Let users view usage and manage keys
3. **Add Analytics** - Track feature usage
4. **Set Up Alerts** - Monitor for issues
5. **Plan Features** - What else can you gate?

---

**🔐 Your API key system is production-ready!**
