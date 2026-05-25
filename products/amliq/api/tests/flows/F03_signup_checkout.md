# F03: Signup & LemonSqueezy Checkout

**Objective:** Verify free trial signup and subscription activation flow.
**Prerequisites:** Marketing page with checkout link, LemonSqueezy test environment configured

## Test Steps

1. **Navigate to Checkout:** Click "Start Free Trial", verify redirect to LemonSqueezy, checkout form visible
2. **Apply Free Promo:** Locate promo input, enter `AMLIQ_FREE`, verify "100% off" badge, price updates to $0.00
3. **Test Invalid Code:** Clear field, enter `INVALID_CODE`, verify error "Invalid or expired promo code", price reverts
4. **Fill Form:** Enter email `testuser@aegis-test.com`, name `Test User`, country `United States`
5. **Payment with Test Card:** Click card input, enter `4242 4242 4242 4242`, expiry `12/25`, CVC `123`, cardholder name `Test User`, click "Pay now"
6. **Verify Success:** Wait for processing, verify success page with order confirmation and automatic redirect to `/dashboard`
7. **Check Subscription:** Navigate to `/billing`, verify subscription active with correct product/plan/status/renewal date
8. **Verify Access:** Navigate to screening page, attempt API call, verify access granted (no "upgrade required" message)
9. **Test Expired Card:** Start new checkout, re-apply `AMLIQ_FREE` promo, enter expired card `4000 0000 0000 0002`, verify decline error
10. **Verify Audit:** Check audit log/activity history, verify checkout and payment recorded

## Validation

- Free trial promo applies 100% discount; invalid codes rejected
- Payment processing succeeds; subscription appears immediately
- User gains access without additional setup
- Failed payments handled gracefully

## Expected Result

Complete checkout flow succeeds with free trial promo; user account created and subscription active with immediate dashboard access.

---

*F03 | Signup & Checkout | 2026-03-26*
