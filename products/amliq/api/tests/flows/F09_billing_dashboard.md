# F09: Billing & Subscription Management

**Objective:** Verify billing dashboard displays subscriptions, usage, and seat management.
**Prerequisites:** Authenticated user, navigate to `/billing`

## Test Steps

1. **Page Load:** Navigate to `/billing`, verify title "Billing & Subscriptions", loads in <2 seconds, no errors
2. **Active Subscriptions:** Verify subscription cards/grid for each product (API, Dashboard, SDK, iFrame, Dataset). Each card shows: product name, plan name, price (e.g., "$1,499/month"), status badge "Active", renewal date (e.g., "Renews April 26, 2026"), buttons: Change Plan, Manage Subscription, Cancel
3. **Usage Meters:** Verify progress bars for each subscription. Verify color: green (0-80%), orange (80-95%), red (95-100%). Verify label: "892 / 1,000 API calls used this month", "89% of monthly limit"
4. **Expand Subscription:** Click subscription card, verify expanded view showing: description, included features, usage limits, billing option, next renewal, auto-renewal toggle. Click again to collapse
5. **Seat Manager (Dashboard):** Locate Dashboard subscription, verify "Manage Seats" section listing current occupants: email, role, join date. Verify seat count: "2 of 5 seats used"
6. **Add Seat:** Click "Add Seat", verify modal with email input, role selector (Admin, Editor, Viewer). Enter email "newuser@test.aegis", select "Viewer", click "Add Seat". Verify success, seat count increments "3 of 5", price updates (previous + $69/seat), new user appears as "invited"
7. **Remove Seat:** Hover over seat, click "Remove", verify confirmation "Remove this seat?". Click "Confirm", verify seat removed, marked "Available", count decrements, price adjusted downward
8. **Invoice History:** Verify "Invoices" section with table: Date, Description, Amount, Status, Action. Verify ≥3 invoice rows with "Paid" status. Click "Download" or PDF icon—verify PDF downloads. Click row—verify detail view
9. **Apply Promo Code:** Verify "Promo Code" input section. Enter "AMLIQ_FREE", click "Apply", verify "100% off applied", total shows reduced price, discount visible in subscription cards
10. **Manage Subscription:** Click "Manage Subscription", verify redirect to LemonSqueezy portal. Verify ability to update payment method, billing email, view invoice history. Close portal, verify return to AMLIQ billing
11. **Add Product:** Click "Add Product" or "Browse More Plans", verify modal with available products (SDK, iFrame, Dataset if not subscribed). Click "Select Plan", verify plan options (Starter/Pro/Enterprise), select plan, verify checkout modal or redirect
12. **Usage Summary:** Verify total monthly spend at top (sum of all subscriptions), breakdown per product, upcoming charges next 30 days, annual savings if on annual plan
13. **Billing Settings:** Verify billing email displayed, "Change Billing Email" link. Click—verify email change flow. Verify billing address (if applicable), auto-renewal toggle for each subscription
14. **Upgrade Path Preview:** Click "Change Plan" on subscription, verify plan comparison with current plan highlighted. Select higher tier. Verify "Upgrade" modal with prorated credit calculation. Do NOT click upgrade (covered in F10)
15. **Mobile (375px):** Resize to mobile, verify subscription cards full-width, usage bars readable, action buttons touchable, table converts to card layout, seat manager accessible, no horizontal scroll

## Validation

- All subscriptions display correct details
- Seat management adds/removes seats and updates pricing
- Promo codes apply correctly
- Usage meters show correct percentages
- All action buttons functional
- Mobile layout responsive

## Expected Result

Billing dashboard displays all subscriptions with usage metrics, seat management, invoice history, and promo code support.

---

*F09 | Billing Dashboard | 2026-03-26*
