# DNS Configuration for upm.plus

## Required DNS Records

After deploying UPM.Plus to production, you need to configure the following DNS records for your domain `upm.plus`:

### Get LoadBalancer IP

First, get the external IP of your ingress controller:

```bash
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

Look for the `EXTERNAL-IP` value.

### DNS Records to Configure

Create the following DNS records in your domain registrar's DNS settings:

#### A Records (Primary)

| Hostname | Type | Value | TTL |
|----------|------|-------|-----|
| @ | A | [LOAD_BALANCER_IP] | 300 |
| www | A | [LOAD_BALANCER_IP] | 300 |
| api | A | [LOAD_BALANCER_IP] | 300 |
| app | A | [LOAD_BALANCER_IP] | 300 |
| dashboard | A | [LOAD_BALANCER_IP] | 300 |

#### CNAME Records (Alternative)

If you prefer using CNAME records (recommended for better management):

| Hostname | Type | Value | TTL |
|----------|------|-------|-----|
| www | CNAME | upm.plus | 300 |
| api | CNAME | upm.plus | 300 |
| app | CNAME | upm.plus | 300 |
| dashboard | CNAME | upm.plus | 300 |

Then create a single A record:
| Hostname | Type | Value | TTL |
|----------|------|-------|-----|
| @ | A | [LOAD_BALANCER_IP] | 300 |

## Example Configuration

### Cloudflare Example

1. Log in to Cloudflare
2. Select your domain `upm.plus`
3. Add these DNS records:

```
Type: A
Name: @
IPv4 address: [LOAD_BALANCER_IP]
Proxy status: DNS only (grey cloud)

Type: CNAME
Name: www
Target: upm.plus
Proxy status: DNS only (grey cloud)

Type: CNAME
Name: api
Target: upm.plus
Proxy status: DNS only (grey cloud)

Type: CNAME
Name: app
Target: upm.plus
Proxy status: DNS only (grey cloud)

Type: CNAME
Name: dashboard
Target: upm.plus
Proxy status: DNS only (grey cloud)
```

### Google Domains Example

1. Log in to Google Domains
2. Select your domain `upm.plus`
3. Go to "DNS"
4. Add custom records:

```
@    A    300    [LOAD_BALANCER_IP]
www  CNAME 300    upm.plus
api  CNAME 300    upm.plus
app  CNAME 300    upm.plus
dashboard CNAME 300 upm.plus
```

### Namecheap Example

1. Log in to Namecheap
2. Select your domain `upm.plus`
3. Go to "Advanced DNS"
4. Add these records:

```
Type: A Record
Host: @
Value: [LOAD_BALANCER_IP]
TTL: 300

Type: CNAME Record
Host: www
Value: upm.plus
TTL: 300

Type: CNAME Record
Host: api
Value: upm.plus
TTL: 300

Type: CNAME Record
Host: app
Value: upm.plus
TTL: 300

Type: CNAME Record
Host: dashboard
Value: upm.plus
TTL: 300
```

## Verification

After configuring DNS, verify propagation:

### Check DNS Propagation

```bash
# Check A record
dig upm.plus A

# Check specific subdomains
dig api.upm.plus A
dig app.upm.plus A
dig dashboard.upm.plus A

# Or use nslookup
nslookup upm.plus
nslookup api.upm.plus
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
curl -I https://upm.plus
curl -I https://api.upm.plus/health
curl -I https://app.upm.plus
curl -I https://dashboard.upm.plus
```

## Troubleshooting

### Common Issues

#### DNS Not Propagating
- **Solution**: DNS changes can take up to 24-48 hours to propagate globally. Use tools like [dnschecker.org](https://dnschecker.org) to check propagation status.

#### Certificate Not Issuing
- **Check**: `kubectl describe certificate upm-plus-production-wildcard -n upm-plus`
- **Common causes**:
  - DNS records not pointing correctly
  - Ingress not accessible from internet
  - Firewall blocking ports 80/443

#### Ingress Not Accessible
- **Check LoadBalancer IP**: `kubectl get svc ingress-nginx-controller -n ingress-nginx`
- **Check ingress logs**: `kubectl logs -f deployment/ingress-nginx-controller -n ingress-nginx`

#### SSL Certificate Challenges
- **Check cert-manager logs**: `kubectl logs -f deployment/cert-manager -n cert-manager`
- **Check challenge status**: `kubectl get order -n upm-plus`

### Monitoring Setup

After successful deployment, set up monitoring:

1. **Grafana Dashboard**: Access via port-forward
   ```bash
   kubectl port-forward svc/grafana 3000:3000 -n upm-plus
   ```

2. **Prometheus**: Access via port-forward
   ```bash
   kubectl port-forward svc/prometheus 9090:9090 -n upm-plus
   ```

3. **Alerting**: Configure alerting rules in Grafana or Prometheus

## Security Considerations

### DNS Security

1. **DNSSEC**: Enable DNSSEC if your registrar supports it
2. **CAA Records**: Consider adding CAA records for certificate authority restrictions
3. **DNS Firewall**: Use DNS firewall services if available

### SSL/TLS Security

1. **Certificate Renewal**: Cert-manager will auto-renew certificates
2. **HTTPS Only**: All traffic is forced to HTTPS
3. **HSTS**: HTTP Strict Transport Security is enabled
4. **Security Headers**: Additional security headers are configured

### Network Security

1. **Firewall Rules**: Ensure ports 80 and 443 are open
2. **Network Policies**: Kubernetes network policies restrict traffic
3. **Pod Security**: Pod security policies are enabled

## Next Steps

After DNS configuration and verification:

1. **Test All Subdomains**: Ensure all subdomains work correctly
2. **Set Up Monitoring**: Configure monitoring and alerting
3. **Configure Backups**: Set up automated backup strategies
4. **Performance Tuning**: Optimize based on usage patterns
5. **Security Audit**: Perform security review and testing
6. **Documentation**: Update internal documentation with deployment details

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Kubernetes logs: `kubectl logs -f [pod-name] -n upm-plus`
3. Check certificate status: `kubectl get certificate -n upm-plus`
4. Verify DNS propagation with online tools
5. Test connectivity with curl or browser tools

For additional support, refer to the UPM.Plus documentation or create an issue in the repository.