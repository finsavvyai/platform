# 🌐 UDP Platform Domain Configuration

## Your Domains
- **upmplus.dev** ✅ (Recommended)
- **upm.plus** ✅ (Alternative)
- **upmplus.ai** ✅ (AI-focused)

## Recommended Setup: upmplus.dev

### Step 1: DNS Configuration
Add these DNS records to your domain:

```
Type: A
Name: @
Value: 34.29.39.106

Type: A  
Name: www
Value: 34.29.39.106

Type: A
Name: api
Value: 34.29.39.106

Type: A
Name: platform
Value: 34.29.39.106
```

### Step 2: Subdomain Structure
- **Main Platform**: https://upmplus.dev
- **API Endpoint**: https://api.upmplus.dev
- **Documentation**: https://docs.upmplus.dev
- **Admin Panel**: https://admin.upmplus.dev

### Step 3: SSL Certificate Setup
```bash
# Create SSL certificate for your domain
gcloud compute ssl-certificates create upmplus-ssl \
  --domains upmplus.dev,www.upmplus.dev,api.upmplus.dev \
  --global
```

### Step 4: Update Kubernetes Service
```yaml
# Update your Kubernetes service to use the domain
apiVersion: v1
kind: Service
metadata:
  name: udp-service
  annotations:
    kubernetes.io/ingress.class: "gce"
    kubernetes.io/ingress.global-static-ip-name: "upmplus-ip"
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 8000
    protocol: TCP
  - port: 443
    targetPort: 8000
    protocol: TCP
  selector:
    app: udp-api
```

## Alternative: upm.plus

If you prefer `upm.plus`:

```
Type: A
Name: @
Value: 34.29.39.106

Type: A
Name: www
Value: 34.29.39.106

Type: A
Name: api
Value: 34.29.39.106
```

## Alternative: upmplus.ai

If you prefer `upmplus.ai`:

```
Type: A
Name: @
Value: 34.29.39.106

Type: A
Name: www
Value: 34.29.39.106

Type: A
Name: api
Value: 34.29.39.106
```

## Benefits of Using Your Own Domain

1. **Professional**: Your own branded domain
2. **Trust**: Users trust your domain
3. **SEO**: Better search engine optimization
4. **Branding**: Consistent with your brand
5. **SSL**: Easy to set up SSL certificates
6. **Subdomains**: Can create multiple services

## Next Steps

1. **Choose your preferred domain** (upmplus.dev recommended)
2. **Update DNS records** in your domain registrar
3. **Set up SSL certificate** for HTTPS
4. **Update TEDDK configuration** with your domain
5. **Test the new domain**

## TEDDK Configuration Update

Once you set up the domain, update your TEDDK project:

```yaml
# /Users/shaharsolomon/projects/telia/teddk/udp.yml
udp_platform:
  base_url: "https://upmplus.dev"  # Your domain!
  api_endpoint: "https://api.upmplus.dev"
  api_key: "your-api-key-here"
  timeout: 30000
  retry_attempts: 3
```

## Testing Commands

```bash
# Test your domain (after DNS propagation)
curl https://upmplus.dev/health
curl https://upmplus.dev/
curl https://api.upmplus.dev/health
```

Your UDP platform will be much more professional with your own domain! 🚀


