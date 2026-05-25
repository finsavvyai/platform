# 🔧 Cloudflare API Token Fix Guide

## **Current Issue**
Your API token is missing critical permissions for deploying Workers and managing Cloudflare resources.

## **Quick Fix Steps**

### **1. Create New API Token**
Go to: https://dash.cloudflare.com/profile/api-tokens

Click **Create Token** → **Custom token**

### **2. Configure Permissions**

#### **Account Permissions:**
```
✅ Account Settings: Read
✅ Account Settings: Edit
✅ User Details: Read
✅ Memberships: Read
```

#### **Zone Permissions:**
```
✅ Zone Settings: Read
✅ Zone Settings: Edit
✅ Zone: Read
✅ DNS: Edit
```

#### **Workers & Edge Computing:**
```
✅ Account Cloudflare Workers: Edit
✅ Account Cloudflare Workers Scripts: Edit
✅ Account D1: Edit
✅ Account KV Namespace: Edit
```

#### **Optional but Recommended:**
```
✅ Account Queues: Edit
✅ Account R2: Edit
✅ Account Pages: Edit
```

### **3. Add Zone Resources**
```
✅ upm.plus - All zones
✅ upmplus.dev - All zones (staging)
✅ upmplus.io - All zones (staging)
```

### **4. Create and Copy Token**
- Give it a descriptive name: "UPM.Plus Production Token"
- Set TTL (recommended: 1 year)
- Copy the token immediately (it won't be shown again)

### **5. Update Environment Variable**

#### **For macOS/Linux:**
```bash
export CLOUDFLARE_API_TOKEN="your-new-token-here"
```

#### **For your .env file:**
```bash
CLOUDFLARE_API_TOKEN=your-new-token-here
```

#### **For permanent setup:**
```bash
echo 'export CLOUDFLARE_API_TOKEN="your-new-token-here"' >> ~/.zshrc
source ~/.zshrc
```

### **6. Verify Token**
```bash
wrangler whoami
```

You should see your email address and full account details without any warnings.

## **Alternative: Use Wrangler Auth**

If API token setup is complex, you can use browser-based auth:

```bash
# Remove current token first
unset CLOUDFLARE_API_TOKEN

# Re-authenticate with browser
wrangler auth login
```

## **Testing the Fix**

After updating the token, test deployment:

```bash
# Test deployment
wrangler deploy --env production

# Test queue creation (if needed)
wrangler queues create upm-plus-queue
```

## **Troubleshooting**

If you still get permission errors:

1. **Verify all permissions** are checked in the token
2. **Check zone permissions** - ensure your domains are included
3. **Account permissions** - make sure you have Account Settings:Edit
4. **Wait a few minutes** - sometimes token propagation takes time
5. **Clear wrangler cache**: `rm -rf .wrangler`

## **Required Minimum Permissions for Production**

At minimum, you need these permissions:
- Account Cloudflare Workers: Edit
- Account Cloudflare Workers Scripts: Edit
- Account D1: Edit
- Account KV Namespace: Edit
- Account Settings: Read
- User Details: Read
- Zone Settings: Edit (for your domains)
- Zone: Read (for your domains)

## **Success Indicators**

✅ `wrangler whoami` shows your email
✅ `wrangler deploy --env production` works without permission errors
✅ `wrangler queues create` works (if needed)
✅ Worker deploys successfully to upm.plus