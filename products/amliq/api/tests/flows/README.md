# AMLIQ AML Platform - Test Flows

Manual test flows for verifying AMLIQ AML platform functionality using Claude Chrome browser extension.

## How to Use These Test Flows

1. Open Claude in Chrome and navigate to the AMLIQ platform URL
2. Follow the step-by-step instructions in each flow document
3. Use Claude to observe UI elements, validate results, and take screenshots
4. Record results in the Status Tracking table below
5. Note any console errors or unexpected behavior

## Prerequisites

- AMLIQ platform running locally or on test environment
- Test account credentials with proper permissions
- LemonSqueezy sandbox account for payment testing
- Test data loaded (entity lists, sample alerts)
- Browser console open for error monitoring

## Test Environment Setup

```
Base URL: http://localhost:3000 (or staging.aegis.local)
API Endpoint: http://localhost:3001 (or staging-api.aegis.local)
Test Admin: admin@test.aegis | password: TestPass123!
Test User: user@test.aegis | password: TestPass123!
Free Trial Promo: AMLIQ_FREE (100% discount)
Test Card: 4242 4242 4242 4242 | Exp: 12/25 | CVC: 123
```

## Status Tracking

| Flow | Last Tested | Status | Tester | Notes |
|------|-------------|--------|--------|-------|
| F01 Marketing Landing | - | Pending | - | |
| F02 Pricing Page | - | Pending | - | |
| F03 Signup & Checkout | - | Pending | - | |
| F04 Dashboard Overview | - | Pending | - | |
| F05 Manual Screening | - | Pending | - | |
| F06 Alert Queue | - | Pending | - | |
| F07 Alert Detail | - | Pending | - | |
| F08 Configuration | - | Pending | - | |
| F09 Billing Dashboard | - | Pending | - | |
| F10 Plan Upgrade | - | Pending | - | |
| F11 Usage Limits | - | Pending | - | |
| F12 Audit Trail | - | Pending | - | |
| F13 Analytics | - | Pending | - | |
| F14 iFrame Widget | - | Pending | - | |
| F15 Dataset CSV | - | Pending | - | |
| F16 API Security | - | Pending | - | |
| F17 Mobile Responsive | - | Pending | - | |
| F18 Accessibility | - | Pending | - | |

## Quick Flow Summary

**Marketing (Public):** F01, F02, F03
**Dashboard (Authenticated):** F04, F05, F06, F07, F08
**Billing (Authenticated):** F09, F10, F11
**Admin/Audit:** F12, F13
**Integration:** F14, F15, F16
**QA:** F17, F18

---

*Last Updated: 2026-03-26*
