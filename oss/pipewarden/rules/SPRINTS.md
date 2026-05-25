# Code Safety Suite — Sprint Plan

> **Read first:** `portfolio/QUALITY_STANDARDS.md`
> **Wave:** 5 · **Readiness:** 72% · **Stack:** TypeScript (Next.js, Vercel, SSL/CDN)
> **Timeline:** 7 days · **Ship by:** Week 12

---

## Pre-Sprint: Migrate to @finsavvyai Shared Libraries

### Agent A: Production domain + SSL + CDN on Cloudflare [PARALLEL]
**Prompt:**
Set up production domain and infrastructure for Code Safety Suite. Register production domain (or transfer existing). Configure DNS on Cloudflare (nameserver setup). Enable SSL/TLS (automatic certificate provisioning). Set up CDN for static assets (images, CSS, JS bundles). Configure page rules for caching (cache assets for 1 year, HTML for 10 mins). Enable security features: DDoS protection, WAF (Web Application Firewall), bot management. Set up analytics tracking (Cloudflare Analytics). Configure custom error pages (404, 500). Test SSL certificate validation and HTTPS redirect. Implement HSTS header (strict-transport-security). Ensure all subdomains covered (api.*, www.*). Document domain and DNS configuration.

### Agent B: Payment with @finsavvyai/pay [PARALLEL]
**Prompt:**
Integrate payment processing using `@finsavvyai/pay` (Stripe/LemonSqueezy) for Code Safety Suite. Implement checkout endpoint for subscription tiers (free: 1000 scans/month, pro: unlimited scans, enterprise: custom). Create subscription management (create, update, cancel). Handle webhook for payment.success → activate subscription, payment.failed → deactivate. Implement usage tracking per subscription (scans, active projects). Add rate limiting per tier (100 scans/day for free). Store subscription state in secure database. Implement refund flow (7-day money back guarantee). Ensure PCI compliance. Run `npm audit` + `eslint-plugin-security` for zero high/critical findings.

---

## Sprint Tasks

### Agent C: Security self-audit + QA [SEQUENTIAL]
**Prompt:**
Execute comprehensive security self-audit of Code Safety Suite before launch. Run security scans: `npm audit` for dependencies, `eslint-plugin-security` for code patterns, OWASP Top 10 checklist. Perform penetration testing simulation: try SQL injection, XSS, CSRF, auth bypass. Check HTTPS everywhere, CSP headers, X-Frame-Options. Validate input sanitization on all forms. Check for hardcoded secrets (scan codebase with detect-secrets or similar). Review error messages (no sensitive data exposure). Test rate limiting, password requirements, session timeout. Verify audit logging for security events. Create security report. Fix any findings before launch. Perform final QA: run all tests, verify payment flow, check performance. Launch to production.

---

## Quality Verification

### Agent QA: Full Quality Gate [SEQUENTIAL]
**Prompt:**
Execute final quality verification:

1. Coverage: `npm run test -- --coverage --fail_under=95` — must show ≥95%
2. Security: `npm audit` + `eslint-plugin-security` + manual pen test — zero findings
3. File size: All `.ts`/`.tsx` files ≤200 lines
4. Domain: Production domain active, DNS configured
5. SSL: Certificate valid, HTTPS enforced, HSTS header present
6. CDN: Static assets cached, TTL correct, geographic distribution working
7. Cloudflare: DDoS protection enabled, WAF configured, analytics working
8. Payment: Checkout flow tested end-to-end
9. Subscriptions: Tiers enforced (free, pro, enterprise)
10. Usage tracking: Accurate scan counts per tier
11. Rate limiting: Enforced per tier (100 scans/day for free)
12. Error messages: No sensitive data in error output
13. Input validation: All forms validated client and server-side
14. Auth: Session management secure, timeout working
15. Audit logging: Security events logged and accessible

Report any blockers. All checks must pass.

---

## Quality Gate Checklist
□ 95%+ test coverage (vitest/jest)
□ ≤200 lines per source file (.ts, .tsx)
□ Security scan clean (npm audit, eslint-plugin-security — zero findings)
□ No secrets in code (env vars only)
□ Production domain active and configured
□ DNS on Cloudflare with correct nameservers
□ SSL certificate valid (auto-provisioned)
□ HTTPS enforced on all pages
□ HSTS header present and correct
□ CDN caching configured (assets 1yr, HTML 10min)
□ Cloudflare DDoS protection enabled
□ Cloudflare WAF configured
□ Cloudflare analytics tracking working
□ Custom error pages configured
□ @finsavvyai/pay integrated
□ Subscription tiers working (free, pro, enterprise)
□ Usage tracking accurate
□ Rate limiting enforced
□ Payment webhook handlers tested
□ Input validation complete (client + server)
□ Error messages safe (no data exposure)
□ Session management secure
□ Audit logging functional
□ Penetration test passed (no vulnerabilities)
