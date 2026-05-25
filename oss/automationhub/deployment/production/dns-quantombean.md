# DNS Configuration for quantombean.io

## Required DNS Records

After deploying UPM.Plus to production, you need to configure the following DNS records for your domain `quantombean.io`:

## Get LoadBalancer IP

First, get the external IP of your ingress controller:

```bash
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

Look for the `EXTERNAL-IP` value and replace `[LOAD_BALANCER_IP]` in the records below.

## DNS Records to Configure

### Option 1: A Records (Recommended)

Create the following DNS records in your domain registrar's DNS settings:

| Hostname | Type | Value | TTL |
|----------|------|-------|-----|
| @ | A | [LOAD_BALANCER_IP] | 300 |
| www | A | [LOAD_BALANCER_IP] | 300 |
| api | A | [LOAD_BALANCER_IP] | 300 |
| app | A | [LOAD_BALANCER_IP] | 300 |
| dashboard | A | [LOAD_BALANCER_IP] | 300 |

### Option 2: CNAME Records

If you prefer using CNAME records (better for management):

| Hostname | Type | Value | TTL |
|----------|------|-------|-----|
| www | CNAME | quantombean.io | 300 |
| api | CNAME | quantombean.io | 300 |
| app | CNAME | quantombean.io | 300 |
| dashboard | CNAME | quantombean.io | 300 |

Then create a single A record:
| Hostname | Type | Value | TTL |
|----------|------|-------|-----|
| @ | A | [LOAD_BALANCER_IP] | 300 |

## Domain Registrar Instructions

### Cloudflare

1. Log in to Cloudflare
2. Select your domain `quantombean.io`
3. Add these DNS records:

```
Type: A
Name: @
IPv4 address: [LOAD_BALANCER_IP]
Proxy status: DNS only (grey cloud)

Type: CNAME
Name: www
Target: quantombean.io
Proxy status: DNS only (grey cloud)

Type: CNAME
Name: api
Target: quantombean.io
Proxy status: DNS only (grey cloud)

Type: CNAME
Name: app
Target: quantombean.io
Proxy status: DNS only (grey cloud)

Type: CNAME
Name: dashboard
Target: quantombean.io
Proxy status: DNS only (grey cloud)
```

### Google Domains

1. Log in to Google Domains
2. Select your domain `quantombean.io`
3. Go to "DNS"
4. Add custom records:

```
@    A    300    [LOAD_BALANCER_IP]
www  CNAME 300    quantombean.io
api  CNAME 300    quantombean.io
app  CNAME 300    quantombean.io
dashboard CNAME 300 quantombean.io
```

### Namecheap

1. Log in to Namecheap
2. Select your domain `quantombean.io`
3. Go to "Advanced DNS"
4. Add these records:

```
Type: A Record
Host: @
Value: [LOAD_BALANCER_IP]
TTL: 300

Type: CNAME Record
Host: www
Value: quantombean.io
TTL: 300

Type: CNAME Record
Host: api
Value: quantombean.io
TTL: 300

Type: CNAME Record
Host: app
Value: quantombean.io
TTL: 300

Type: CNAME Record
Host: dashboard
Value: quantombean.io
TTL: 300
```

### GoDaddy

1. Log in to GoDaddy
2. Select your domain `quantombean.io`
3. Go to "DNS Management"
4. Add these records:

```
Type: A
Name: @
Value: [LOAD_BALANCER_IP]
TTL: 600 (1 Hour)

Type: CNAME
Name: www
Value: quantombean.io
TTL: 600 (1 Hour)

Type: CNAME
Name: api
Value: quantombean.io
TTL: 600 (1 Hour)

Type: CNAME
Name: app
Value: quantombean.io
TTL: 600 (1 Hour)

Type: CNAME
Name: dashboard
Value: quantombean.io
TTL: 600 (1 Hour)
```

## Verification

After configuring DNS, verify propagation:

### Check DNS Propagation

```bash
# Check A record
dig quantombean.io A

# Check specific subdomains
dig api.quantombean.io A
dig app.quantombean.io A
dig dashboard.quantombean.io A

# Or use nslookup
nslookup quantombean.io
nslookup api.quantombean.io
```

### Check SSL Certificate

```bash
# Check certificate status
kubectl get certificate upm-plus-production-wildcard -n upm-plus

# Describe certificate for details
kubectl describe certificate upm-plus-production-wildcard -n upm-plus
```

### Test HTTPS Access

```bash
# Test HTTPS connectivity
curl -I https://quantombean.io
curl -I https://api.quantombean.io/health
curl -I https://app.quantombean.io
curl -I https://dashboard.quantombean.io
```

### Online DNS Tools

Use these online tools to check DNS propagation:

- [dnschecker.org](https://dnschecker.org)
- [whatsmydns.net](https://whatsmydns.net)
- [google-public-dns.appspot.com](https://google-public-dns.appspot.com)

## Expected Configuration

### After DNS Setup

Your domain should resolve as follows:

- **quantombean.io** → Main UPM.Plus application
- **www.quantombean.io** → Redirects to quantombean.io
- **api.quantombean.io** → API endpoints for the application
- **app.quantombean.io** → Alternative application URL
- **dashboard.quantombean.io** → Monitoring dashboard

### SSL Certificate Coverage

The Let's Encrypt certificate will cover:
- quantombean.io
- www.quantombean.io
- api.quantombean.io
- app.quantombean.io
- dashboard.quantombean.io
- *.quantombean.io (wildcard for future subdomains)

## Troubleshooting

### DNS Issues

1. **DNS Not Propagating**
   - DNS changes can take 24-48 hours to propagate globally
   - Use dnschecker.org to check propagation from different locations
   - Some DNS providers update faster than others

2. **CNAME Loop**
   - Ensure you don't create CNAME records that point to themselves
   - Verify you're not mixing A and CNAME records for the same hostname

3. **Incorrect IP Address**
   - Double-check the LoadBalancer IP from kubectl
   - Ensure you're using the correct external IP

### SSL Certificate Issues

1. **Certificate Not Issuing**
   ```bash
   kubectl describe certificate upm-plus-production-wildcard -n upm-plus
   ```
   Common causes:
   - DNS records not pointing correctly
   - Ingress not accessible from internet
   - Firewall blocking ports 80/443

2. **Certificate Challenge Failed**
   ```bash
   kubectl logs -f deployment/cert-manager -n cert-manager
   ```
   Check for ACME challenge errors

### Ingress Issues

1. **LoadBalancer IP Not Assigned**
   ```bash
   kubectl get svc ingress-nginx-controller -n ingress-nginx
   ```
   - Ensure your cloud provider supports LoadBalancer services
   - Check if you need to configure additional cloud resources

2. **404 Errors**
   - Verify ingress rules are configured correctly
   - Check if services exist and are running
   - Ensure service names match ingress configuration

## Security Considerations

### DNS Security

1. **DNSSEC**: Enable DNSSEC if your registrar supports it
2. **CAA Records**: Consider adding CAA records for certificate restrictions
3. **DNS Firewall**: Use DNS firewall services if available

### SSL/TLS Security

1. **Certificate Renewal**: Cert-manager will auto-renew certificates
2. **HTTPS Only**: All traffic is forced to HTTPS
3. **HSTS**: HTTP Strict Transport Security is enabled
4. **Security Headers**: Additional security headers are configured

## Testing Checklist

Before going live, verify:

- [ ] DNS records are configured correctly
- [ ] DNS propagation is complete globally
- [ ] SSL certificate is issued and valid
- [ ] All subdomains resolve correctly
- [ ] HTTPS access works for all subdomains
- [ ] No SSL certificate errors in browsers
- [ ] Application loads correctly on all URLs

## Monitoring DNS and SSL

After setup, monitor:

```bash
# Check certificate status regularly
kubectl get certificate -n upm-plus

# Monitor ingress logs
kubectl logs -f deployment/ingress-nginx-controller -n ingress-nginx

# Check certificate expiration
kubectl describe certificate upm-plus-production-wildcard -n upm-plus
```

## Next Steps

After DNS configuration and verification:

1. **Test All Subdomains**: Ensure all URLs work correctly
2. **Set Up Monitoring**: Configure monitoring and alerting
3. **Configure Backups**: Set up automated backup strategies
4. **Performance Tuning**: Optimize based on usage patterns
5. **Security Audit**: Perform security review and testing
6. **Documentation**: Update internal documentation

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Kubernetes logs: `kubectl logs -f [pod-name] -n upm-plus`
3. Check certificate status: `kubectl get certificate -n upm-plus`
4. Verify DNS propagation with online tools
5. Test connectivity with curl or browser tools

For additional support, refer to the UPM.Plus documentation or create an issue in the repository.