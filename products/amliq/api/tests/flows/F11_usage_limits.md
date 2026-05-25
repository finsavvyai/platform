# F11: Usage Limits & Overage Handling

**Objective:** Verify usage limit enforcement and overage messaging at different threshold levels.
**Prerequisites:** Authenticated user, ability to adjust usage for testing (test mode/simulation)

## Test Steps

1. **Usage at Normal Level (0-80%):** Navigate to `/billing`, verify subscription usage 50% or below with green progress bar. Verify no warnings. Navigate to `/screen`—verify no restrictions. Attempt API call—verify succeeds
2. **Usage at 80% (Orange Warning):** Via test mode, set usage to 800/1,000 calls. Navigate to `/billing`, verify bar changes orange. Verify warning: "You're approaching your usage limit. 200 calls remaining. Upgrade to increase limit". Verify "Upgrade Plan" button prominent. Attempt API call—verify succeeds
3. **Usage at 95% (Red Critical):** Set usage to 950/1,000. Verify bar red, critical warning: "Critical: You're near your usage limit. Only 50 calls remaining. Service may be restricted at 100%". Verify banner in bright red at page top. Click "Upgrade Plan"—verify redirect to upgrade page
4. **Usage at 100% (Limit Reached):** Set usage to 1,000/1,000. Verify bar shows "100% - Limit Reached". Verify critical banner: "You've reached your API call limit. Please upgrade or wait until next billing period"
5. **API Call at 100%:** Attempt API call via screening/API. Verify response: HTTP 402 Payment Required with error: "Usage limit exceeded. Monthly limit reached. Upgrade to continue". Verify headers: X-RateLimit-Remaining: 0. Verify no partial result returned
6. **Dashboard Screening at 100%:** Navigate to `/screen`, verify alert banner "Screening Disabled". Verify message "Usage limit has been reached". Verify form disabled (inputs greyed out), submit button disabled with tooltip "Upgrade required". Verify "Upgrade to Continue" button visible
7. **Upgrade to Restore:** Click "Upgrade" from `/billing`, select higher tier (e.g., Professional: 10,000 calls). Confirm upgrade. Verify new limit displayed: "1,000 / 10,000 API calls". Verify bar green again
8. **Access Restored:** Navigate to `/screen`, verify form enabled (not greyed), submit button clickable. Perform screening—verify succeeds
9. **Different Product Limits:** Verify each product has separate usage: API Starter (1,000/month), Dashboard Base (1,000 screenings), Dataset Standard (12 fetches), iFrame Basic (5,000 lookups). Set one product (e.g., iFrame) to 100%. Verify only iFrame shows "limit reached", others work normally
10. **Seat Limit (Dashboard):** If Dashboard has seat limit (5 seats), add 5 users to reach limit. Verify "5 / 5 seats used". Attempt to add 6th user. Verify error "Seat limit reached". Click "Add Seat"—verify upgrade/payment flow for additional seat
11. **Monthly Reset:** At month end (test environment), with usage at 100%. Advance to next month. Verify usage resets to "0 / 1,000", green bar returns, access restored automatically
12. **Annual Billing Higher Limits:** Compare monthly vs annual billing. Verify annual shows higher limits: API Starter (1,200 calls). Switch to annual, verify limit updates and is applied immediately
13. **Rollover Check:** If supported, set usage to 800/1,000 at month end. Advance to next month. Verify new month limit reflects either: no rollover (0/1,000) or rollover (200/1,200)
14. **Rate Limit Headers:** Make API call, inspect response headers. Verify: X-RateLimit-Limit: 1000, X-RateLimit-Remaining: 95 (or appropriate), X-RateLimit-Reset: [unix_timestamp]. At 100% usage, verify Remaining: 0
15. **Mobile (375px):** Resize to mobile, navigate to `/billing` with high usage. Verify warning banners display clearly, progress bar readable, "Upgrade" buttons touchable. Navigate to `/screen`—verify disabled state clear on mobile

## Validation

- Progress bars change color at correct thresholds (80%, 95%, 100%)
- Warning messages appear appropriately
- API calls fail with 402 when limit reached
- Dashboard screening disabled when limit reached
- Upgrade immediately restores access
- Usage resets monthly as expected
- Different products have independent limits
- Rate limit headers present and accurate

## Expected Result

Usage limits enforced at 100% with progressive warnings at 80% and 95%, preventing API calls with 402 response and disabling features while allowing upgrade to immediately restore service.

---

*F11 | Usage Limits | 2026-03-26*
