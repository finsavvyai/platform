# ⚡ Quick Setup: rag.lunaos.ai

## 🎯 Goal
Connect your custom domain `rag.lunaos.ai` to the Luna Vision RAG™ worker.

---

## 📝 Step-by-Step Instructions

### Step 1: Add Worker Route in Cloudflare Dashboard

1. **Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com
   - Select domain: **lunaos.ai**

2. **Navigate to Workers Routes**
   - Click on **Workers Routes** in the left sidebar
   - OR go to: **Workers & Pages** → **Overview** → Click on **luna-vision-rag** → **Settings** → **Triggers** → **Routes**

3. **Add Route**
   - Click **Add route** button
   - **Route**: `rag.lunaos.ai/*`
   - **Worker**: Select `luna-vision-rag` from dropdown
   - **Zone**: `lunaos.ai`
   - Click **Save**

### Step 2: Verify DNS (Should Already Exist)

1. **Check DNS Settings**
   - Go to **DNS** → **Records**
   - Look for existing `rag` record

2. **If DNS Record Doesn't Exist, Add It**
   - Click **Add record**
   - **Type**: `CNAME`
   - **Name**: `rag`
   - **Target**: `luna-vision-rag.broad-dew-49ad.workers.dev`
   - **Proxy status**: ✅ Proxied (orange cloud icon)
   - **TTL**: Auto
   - Click **Save**

### Step 3: Test Your Domain

Wait 1-2 minutes for DNS propagation, then test:

```bash
# Test health endpoint
curl https://rag.lunaos.ai/health

# Expected response:
# {"status":"healthy","service":"Luna Vision RAG","version":"1.0.0",...}
```

---

## ✅ Verification Commands

```bash
# 1. Check DNS resolution
dig rag.lunaos.ai

# 2. Test HTTPS
curl -I https://rag.lunaos.ai/health

# 3. Test API endpoint
curl -X POST https://rag.lunaos.ai/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query":"test","collectionName":"demo","topK":5}'

# 4. Check response time
curl -w "\nTime: %{time_total}s\n" https://rag.lunaos.ai/health
```

---

## 🎉 Success!

Once working, you'll have:
- ✅ **Primary URL**: https://rag.lunaos.ai
- ✅ **Fallback URL**: https://luna-vision-rag.broad-dew-49ad.workers.dev
- ✅ **SSL Certificate**: Automatic (Cloudflare)
- ✅ **Global CDN**: 200+ data centers

---

## 🔧 Troubleshooting

### DNS Not Resolving
**Wait 1-5 minutes** for DNS propagation

### 522 Error
Worker route not configured correctly. Double-check Step 1.

### 404 Error
Route pattern incorrect. Ensure it's `rag.lunaos.ai/*` (with the `/*`)

### SSL Error
Make sure **Proxy status** is enabled (orange cloud) in DNS settings

---

## 📊 Configuration Summary

| Setting | Value |
|---------|-------|
| **Worker Name** | luna-vision-rag |
| **Custom Domain** | rag.lunaos.ai |
| **Route Pattern** | rag.lunaos.ai/* |
| **Zone** | lunaos.ai |
| **Zone ID** | cb6caa02e2da8b39e826cd6ba9fb18df |
| **Workers.dev URL** | luna-vision-rag.broad-dew-49ad.workers.dev |

---

## 🚀 Next Steps

After domain is live:
1. Update all documentation with new domain
2. Test all API endpoints
3. Update marketing materials
4. Announce the new domain!

**Your Luna Vision RAG™ will be live at: https://rag.lunaos.ai** 🎉
