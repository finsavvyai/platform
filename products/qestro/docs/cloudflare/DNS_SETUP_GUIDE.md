# DNS Setup Guide for Questro API Subdomains

## Quick Overview

You need to create **2 A records** in your Cloudflare dashboard to complete the migration.

## Step-by-Step Instructions

### 1. Login to Cloudflare
- Go to https://dash.cloudflare.com
- Login with your credentials

### 2. Configure api.qestro.io
1. Click on **qestro.io** in your domain list
2. Click **DNS** in the left sidebar
3. Click **"Add record"**
4. Fill in the form:
   - **Type**: `A`
   - **Name**: `api`
   - **IPv4 address**: `192.0.2.1`
   - **Proxy status**: 🟠 **Proxied** (orange cloud)
   - **TTL**: `Auto`
5. Click **"Save"**

### 3. Configure api.qestro.app
1. Go back to domain list
2. Click on **qestro.app**
3. Click **DNS** in the left sidebar
4. Click **"Add record"**
5. Fill in the form:
   - **Type**: `A`
   - **Name**: `api`
   - **IPv4 address**: `192.0.2.1`
   - **Proxy status**: 🟠 **Proxied** (orange cloud)
   - **TTL**: `Auto`
6. Click **"Save"**

## Visual Example

```
┌─────────────────────────────────────┐
│ Add DNS record                       │
├─────────────────────────────────────┤
│ Type:        A ▼                    │
│ Name:        api                    │
│ IPv4 address: 192.0.2.1             │
│ Proxy:       🟠 Proxied             │
│ TTL:         Auto                   │
│                                     │
│      [  Save  ]  [ Cancel ]        │
└─────────────────────────────────────┘
```

## Why 192.0.2.1?

This is a reserved documentation IP (RFC 5737). Cloudflare Workers routing will handle the actual requests through the patterns in `wrangler.toml`, so the IP address itself doesn't matter - it just needs to exist for the DNS record.

## After Creating Records

1. **Wait 2-5 minutes** for DNS propagation
2. **Test with**: `/scripts/deployment/complete-migration-test.sh`
3. **Expected results**:
   ```
   ✅ api.qestro.io resolves to [IP]
   ✅ api.qestro.app resolves to [IP]
   ✅ Health endpoints respond with 200 OK
   ✅ CORS headers present
   ```

## Troubleshooting

### DNS Not Propagating
- Wait 5-10 minutes and try again
- Clear your local DNS cache: `sudo dscacheutil -flushcache` (macOS)
- Try from a different browser/incognito window

### API Not Responding
- Check Cloudflare Workers logs in dashboard
- Verify wrangler.toml routing patterns are correct
- Ensure Workers are deployed: `wrangler deploy`

### CORS Issues
- Check that your frontend domains are in CORS configuration
- Verify API requests include proper headers
- Check browser console for specific CORS errors

## What This Achieves

✅ **Professional API URLs**
- `https://api.qestro.io/health`
- `https://api.qestro.app/health`

✅ **Automatic SSL Certificates**
- Free HTTPS from Cloudflare
- Automatic renewal

✅ **Global Edge Network**
- API served from 200+ locations globally
- Low latency for all users

✅ **Enterprise Features**
- DDoS protection
- Rate limiting
- Analytics and logs

Once DNS records are created, run the test script to verify everything works!