# 🌐 UDP Platform Domain Setup

## Current Status
- **Platform**: Running on Google Cloud
- **Current IP**: http://34.29.39.106/
- **New Reserved IP**: 34.149.158.73 (for domain)

## Domain Options

### Option 1: Free Subdomain (Recommended)
Use a free subdomain service like:
- **udp-platform.run.app** (Google Cloud Run domain)
- **udp-platform.web.app** (Firebase hosting)
- **udp-platform.vercel.app** (Vercel)
- **udp-platform.netlify.app** (Netlify)

### Option 2: Custom Domain
If you have a domain, we can set up:
- **udp.yourdomain.com**
- **platform.yourdomain.com**
- **api.yourdomain.com**

### Option 3: Google Cloud Domain
Purchase a domain through Google Cloud:
- **udp-platform.com**
- **udp-platform.net**
- **udp-platform.org**

## Quick Setup (Option 1 - Free Subdomain)

### Step 1: Set up Google Cloud Run Domain
```bash
# Create a Cloud Run service for your UDP platform
gcloud run deploy udp-platform \
  --image gcr.io/udp-project-1758298429/udp:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8000
```

### Step 2: Get the Cloud Run URL
```bash
# Get the Cloud Run service URL
gcloud run services describe udp-platform --region us-central1 --format 'value(status.url)'
```

### Step 3: Custom Domain (if you have one)
```bash
# If you have a domain, map it to Cloud Run
gcloud run domain-mappings create \
  --service udp-platform \
  --domain udp.yourdomain.com \
  --region us-central1
```

## Alternative: Use ngrok for Testing

For immediate testing with a domain:

```bash
# Install ngrok
brew install ngrok

# Expose your local UDP platform
ngrok http 8000
```

This will give you a URL like: `https://abc123.ngrok.io`

## Update TEDDK Configuration

Once you have a domain, update your TEDDK configuration:

```yaml
# udp.yml
udp_platform:
  base_url: "https://udp-platform.run.app"  # Your new domain
  api_key: "your-api-key-here"
  timeout: 30000
  retry_attempts: 3
```

## SSL Certificate Setup

For HTTPS (recommended):

```bash
# Enable SSL for your domain
gcloud compute ssl-certificates create udp-ssl-cert \
  --domains udp.yourdomain.com \
  --global
```

## DNS Configuration

If you have your own domain, add these DNS records:

```
Type: A
Name: udp
Value: 34.149.158.73

Type: CNAME  
Name: platform
Value: udp.yourdomain.com
```

## Testing Your Domain

```bash
# Test the new domain
curl https://udp-platform.run.app/health
curl https://udp-platform.run.app/
```

## Benefits of Using a Domain

1. **Professional**: Looks more professional than IP addresses
2. **SSL**: Easy to set up HTTPS certificates
3. **Memorable**: Easy to remember and share
4. **Stable**: Won't change like IP addresses might
5. **Branding**: Can use your company domain

## Next Steps

1. **Choose your domain option** (free subdomain recommended)
2. **Set up the domain** using the commands above
3. **Update TEDDK configuration** with the new domain
4. **Test the integration** with your Java project
5. **Set up SSL** for secure connections

Your UDP platform will then be accessible at a proper domain instead of an IP address! 🚀


