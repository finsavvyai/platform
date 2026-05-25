# SDLC.ai Production Deployment Guide

## Overview

This guide covers deploying the SDLC.ai Secure Data Learning Platform to production using the enterprise-grade infrastructure on Cloudflare.

## Prerequisites

### Required Tools
- [Terraform](https://www.terraform.io/) >= 1.0
- [curl](https://curl.se/)
- [git](https://git-scm.com/)
- [jq](https://stedolan.github.io/jq/)

### Required Accounts
- Cloudflare account with Enterprise plan
- Stripe account for payment processing
- GitHub account for code deployment

### Required Environment Variables

1. **Copy the environment template:**
   ```bash
   cp .env.example .env.production
   ```

2. **Edit `.env.production` and set your actual values:**

   ```bash
   # Cloudflare Configuration
   CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
   CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
   
   # Domain Configuration
   DOMAIN_NAME=your-domain.com
   ENVIRONMENT=production
   
   # Payment Processing (Stripe)
   STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
   
   # Security Configuration
   ENCRYPTION_KEY=your_master_encryption_key_at_least_32_characters_long
   ```

3. **Source the environment variables:**
   ```bash
   source .env.production
   # or export them individually
   export CLOUDFLARE_API_TOKEN=your_token
   ```

## Quick Deployment

### 1. Prerequisites Check
```bash
./check-prereqs.sh
```

### 2. Deploy to Production
```bash
./deploy.sh
```

This will:
- Initialize Terraform
- Create infrastructure plan
- Deploy all resources
- Run health checks
- Provide deployment summary

## Manual Deployment Steps

If you prefer manual deployment or need more control:

### 1. Initialize Terraform
```bash
cd terraform
terraform init
```

### 2. Plan Deployment
```bash
terraform plan \
  -var="environment=production" \
  -var="domain_name=$DOMAIN_NAME" \
  -var="cloudflare_api_token=$CLOUDFLARE_API_TOKEN" \
  -var="cloudflare_account_id=$CLOUDFLARE_ACCOUNT_ID" \
  -var="stripe_secret_key=$STRIPE_SECRET_KEY" \
  -var="encryption_key=$ENCRYPTION_KEY"
```

### 3. Apply Deployment
```bash
terraform apply
```

## Architecture Overview

### Infrastructure Components

1. **Cloudflare Workers** - Serverless compute
   - API Gateway
   - RAG Service
   - Payment Service (PCI compliant)
   - Real-time Service

2. **Cloudflare D1** - Serverless SQL database
   - Primary database
   - Events database
   - Read-only replicas

3. **Cloudflare Vectorize** - Vector database for RAG
   - 1536-dimensional embeddings
   - Cosine similarity search

4. **Cloudflare R2** - Object storage
   - Document storage
   - Automated backups

5. **Cloudflare KV** - Key-value storage
   - Configuration cache
   - Session storage

6. **Cloudflare Queues** - Message queuing
   - Event processing
   - Payment processing

### Security Features

- **PCI DSS Level 1** compliance
- **WAF** with custom rules
- **Rate limiting** with intelligent throttling
- **Bot management** with advanced detection
- **DDoS protection** always-on
- **End-to-end encryption** (AES-256-GCM)
- **HSM-backed** key management

### Monitoring & Observability

- **Health checks** for all services
- **Real-time metrics** collection
- **Error tracking** with alerting
- **Performance monitoring** with APM
- **Security monitoring** with threat detection

## Post-Deployment Configuration

### 1. DNS Configuration
Update your domain's nameservers to point to Cloudflare:
```
ns1.cloudflare.com
ns2.cloudflare.com
ns3.cloudflare.com
ns4.cloudflare.com
```

### 2. SSL Certificates
SSL certificates are automatically provisioned and managed by Cloudflare.

### 3. Monitoring Setup
Configure monitoring endpoints:
- Health Check: `https://api.your-domain.com/health`
- Metrics: `https://api.your-domain.com/metrics`
- Status Page: `https://status.your-domain.com`

### 4. Backup Configuration
Backups are automatically configured:
- Database snapshots: Daily
- Document storage: Versioned
- Cross-region replication: Enabled

## Operations Guide

### Health Checks
```bash
# Check API Gateway
curl https://api.your-domain.com/health

# Check Payment Service
curl https://api.your-domain.com/payments/health

# Check Frontend
curl -I https://app.your-domain.com
```

### Monitoring
```bash
# Get system metrics
curl https://api.your-domain.com/metrics

# Check system status
curl https://status.your-domain.com/api/status
```

### Scaling
Auto-scaling is configured automatically:
- Min instances: 2
- Max instances: 100
- Target CPU: 70%
- Target Memory: 80%

### Security
```bash
# Test WAF rules
curl -H "User-Agent: BadBot" https://api.your-domain.com

# Test rate limiting
for i in {1..1100}; do curl https://api.your-domain.com/api/test; done
```

## Troubleshooting

### Common Issues

1. **Domain not resolving**
   - Check DNS propagation: `dig your-domain.com`
   - Verify nameservers are pointing to Cloudflare
   - Wait up to 24 hours for DNS propagation

2. **SSL certificate issues**
   - Check SSL status in Cloudflare dashboard
   - Verify domain is fully proxied (orange cloud)
   - Certificate should auto-provision within 24 hours

3. **API returning errors**
   - Check Cloudflare Workers logs
   - Verify environment variables are set
   - Check database connectivity

4. **Payment processing failures**
   - Verify Stripe API keys
   - Check webhook endpoints
   - Review PCI compliance settings

### Logs and Monitoring

Access logs and monitoring:
- Cloudflare Dashboard: Analytics & Logs
- Workers Logs: Real-time worker logs
- R2 Storage: Access logs
- D1 Database: Query logs

### Support Resources

- **Cloudflare Documentation**: https://developers.cloudflare.com/
- **Stripe Documentation**: https://stripe.com/docs
- **SDLC.ai Documentation**: https://docs.your-domain.com
- **Status Page**: https://status.your-domain.com

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review performance metrics
   - Check error rates
   - Monitor security alerts

2. **Monthly**
   - Update dependencies
   - Review backup integrity
   - Optimize database queries

3. **Quarterly**
   - PCI compliance scan
   - Security assessment
   - Performance optimization

4. **Annually**
   - Full security audit
   - Disaster recovery test
   - Architecture review

### Updates

**Terraform Updates:**
```bash
cd terraform
terraform init -upgrade
terraform plan
terraform apply
```

**Worker Updates:**
```bash
# Deploy updated workers
wrangler deploy --env production
```

## Rollback Procedures

### Immediate Rollback
```bash
cd terraform
terraform plan -destroy
terraform apply -destroy
# Then redeploy previous version
```

### Blue-Green Deployment
1. Deploy to staging environment
2. Test thoroughly
3. Update DNS to point to new version
4. Monitor for issues
5. Rollback DNS if needed

## Security Checklist

- [ ] PCI DSS compliance verified
- [ ] WAF rules configured and tested
- [ ] Rate limiting enabled and tested
- [ ] SSL certificates valid
- [ ] Encryption keys rotated (quarterly)
- [ ] Access logs enabled and monitored
- [ ] Backup encryption enabled
- [ ] Security scans passed
- [ ] Incident response procedures documented
- [ ] Team security training completed

## Performance Optimization

### Database Optimization
- Monitor query performance
- Optimize slow queries
- Add appropriate indexes
- Use read replicas for queries

### CDN Optimization
- Configure caching rules
- Optimize cache TTL values
- Enable compression
- Use Argo Smart Routing

### Worker Optimization
- Monitor worker cold starts
- Optimize bundle sizes
- Use edge caching effectively
- Implement proper error handling

## Compliance

### PCI DSS Requirements Met
- ✅ Card data tokenization
- ✅ Encryption at rest and in transit
- ✅ Access control and authentication
- ✅ Audit logging and monitoring
- ✅ Network security and segmentation
- ✅ Secure key management
- ✅ Vulnerability management
- ✅ Penetration testing

### Data Protection
- ✅ GDPR compliance
- ✅ Data retention policies
- ✅ Right to deletion
- ✅ Data portability
- ✅ Privacy by design

## Emergency Procedures

### Security Incident
1. Immediate containment
2. Assess impact and scope
3. Notify stakeholders
4. Engage security team
5. Document and learn

### Service Outage
1. Check status page
2. Verify monitoring alerts
3. Investigate root cause
4. Implement fixes
5. Communicate with users

### Data Breach
1. Immediate containment
2. Assess data exposure
3. Notify affected parties
4. Report to regulators (if required)
5. Implement preventive measures

## Support Contacts

- **Technical Support**: support@sdlc.cc
- **Security Team**: security@sdlc.cc
- **Emergency**: emergency@sdlc.cc
- **Documentation**: https://docs.sdlc.cc
- **Status Page**: https://status.sdlc.cc

---

For additional support or questions, please contact our technical team.