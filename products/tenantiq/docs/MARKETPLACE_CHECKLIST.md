# Microsoft AppSource Listing Checklist

> TenantIQ path to Microsoft Commercial Marketplace

---

## Timeline: 8 weeks total

| Week | Milestone |
|------|-----------|
| 1 | Partner Center account + publisher verification |
| 2 | Entra ID app + SaaS Fulfillment API endpoints |
| 3 | Marketing assets + test trial flow |
| 4 | Submit private preview |
| 5-6 | Iterate on Microsoft feedback |
| 7-8 | Go live on AppSource |

---

## 1. Account Setup (Week 1)

- [ ] Register at partner.microsoft.com
- [ ] Get Microsoft Partner Network ID
- [ ] Complete publisher profile (legal name, EIN/DUNS, contact)
- [ ] Accept Microsoft Publisher Agreement
- [ ] Accept Microsoft AI Cloud Partner Program Agreement
- [ ] Enroll in Commercial Marketplace program

---

## 2. Technical Integration (Week 2-3)

### Authentication
- [ ] Entra ID app registration (single tenant)
- [ ] Microsoft Account (MSA) support
- [ ] Map to existing Clerk JWT flow

### SaaS Fulfillment API v2
- [ ] POST `/api/marketplace/activate` -- provision new subscription
- [ ] POST `/api/marketplace/webhook` -- lifecycle events (ChangePlan, Suspend, Unsubscribe, Reinstate)
- [ ] POST `/api/marketplace/resolve` -- resolve marketplace token
- [ ] GET `/api/marketplace/subscriptions` -- list subscriptions (admin)

### Landing Page
- [ ] `https://app.tenantiq.app/marketplace` -- post-purchase activation page
- [ ] Token resolution flow
- [ ] Plan confirmation + "Get Started" CTA

### Graph Permissions Documentation
- [ ] List all requested Graph scopes with justification
- [ ] Minimum privilege principle documentation

---

## 3. Offer Configuration (Week 3)

### Partner Center Settings
- [ ] Sell through Microsoft: Yes (transactable)
- [ ] CSP availability: Yes (for Pax8/TD SYNNEX)
- [ ] Lead destination: webhook URL

### Plans
- [ ] Starter: $29/tenant/month
- [ ] Professional: $79/tenant/month (recommended)
- [ ] Enterprise: $149/tenant/month
- [ ] Free trial: 14 days

---

## 4. Marketing Assets (Week 3)

### Required
- [ ] Hero image: 1440x860px
- [ ] Logo: 216x216px
- [ ] 3+ product screenshots (1280x720px minimum)
- [ ] 60-second demo video
- [ ] Summary: 200 characters
- [ ] Description: 3000 characters (use CAPABILITIES.md)

### Legal
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] Support URL + email
- [ ] EULA

### Categories
- [ ] Primary: Security
- [ ] Secondary: IT Operations, Monitoring & Diagnostics

---

## 5. Support Requirements

- [ ] 90% case resolution within 2 business days
- [ ] Support email: support@tenantiq.app
- [ ] Documentation URL

---

## 6. Common Rejection Reasons (avoid these)

- Missing/incomplete Fulfillment API responses
- Graph permissions not justified in description
- Trial flow broken or unclear
- Missing MSA + Entra ID auth support
- Screenshots don't match live product
- Missing privacy policy or ToS

---

## 7. Post-Launch

- [ ] Monitor Partner Center analytics
- [ ] Respond to reviews within 48 hours
- [ ] Apply for co-sell ready status
- [ ] Submit for Microsoft 365 Certification (later)

---

## URLs to Configure in Partner Center

| Setting | URL |
|---------|-----|
| Landing page | `https://app.tenantiq.app/marketplace` |
| Webhook | `https://api.tenantiq.app/api/marketplace/webhook` |
| Privacy policy | `https://app.tenantiq.app/privacy` |
| Terms of service | `https://app.tenantiq.app/terms` |
| Support | `https://app.tenantiq.app/support` |

---

## Pro Tip

Start with a **Contact Me** listing (no Fulfillment API needed) to validate demand. Upgrade to transactable once APIs are tested and demand is confirmed.
