# Test Flow P06: Billing Administrator - Rachel Foster

## Persona Profile
- **Name:** Rachel Foster
- **Role:** Finance/Billing Administrator
- **Company:** ComplyTech Solutions
- **Experience Level:** Intermediate (2 years with AMLIQ)
- **Key Goals:** Manage billing, control costs, optimize seat licensing, track API usage, prevent overages
- **Technical Proficiency:** Moderate (comfortable with SaaS dashboards and admin consoles)

## Prerequisites
- AMLIQ deployed at https://2b690a17.aegis-97g.pages.dev
- API available at http://localhost:3001/api/v1
- Billing admin account credentials ready
- Valid promo codes available: "AMLIQ_FREE" (100% discount), "FAKE123" (invalid)
- Chrome browser with extensions enabled
- Network connectivity to both site and API

## Test Flow: Billing Management & Seat Licensing

### Step 1: Login to AMLIQ
- **Action:** Navigate to https://2b690a17.aegis-97g.pages.dev → Click "Login" button → Enter email: rachel.foster@complytech.com → Enter password: BillingAdmin#2024 → Click "Sign In"
- **Expected Result:** Dashboard loads with user menu showing "Rachel Foster" and "Billing Admin" role badge
- **Verify:** Check browser title = "AMLIQ - Dashboard", URL = /dashboard, no console errors
- **Screenshot:** Take after login success
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 2: Navigate to Billing Page
- **Action:** Click "Billing" in left sidebar → Wait for page load (max 3 seconds)
- **Expected Result:** Billing dashboard displays with sections: Current Plan, Product Subscriptions, Usage Meters, Payment Methods, Invoices, Promo Code input field
- **Verify:** All sections visible, page title shows "Billing", no 404 errors in console
- **Screenshot:** Take full billing dashboard
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 3: Review Current Plan
- **Action:** Locate "Current Plan" card → Read plan name, billing cycle dates, renewal date → Click "View Plan Details" button
- **Expected Result:** Current plan details modal shows: Plan Name = "Professional", Status = "Active", Billing Cycle = "Monthly", Renewal = "2026-04-26", Monthly Cost = "$299.00", Seats Included = 10, API Calls/Month = 1,000,000
- **Verify:** All values match expected, modal has close button, no data truncation
- **Screenshot:** Take plan details modal
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 4: Check All 5 Product Subscriptions
- **Action:** Scroll to "Product Subscriptions" section → Verify 5 products: Dashboard (Professional), API Screening (Professional), SDK (Starter), iFrame (Basic), Datasets (Basic)
- **Expected Result:** Each subscription shows: Product Name, Current Tier, Status = "Active", Next Billing Date, Monthly Amount. Total = $299.00/month
- **Verify:** Count = 5 subscriptions, all statuses = "Active", sum amounts = $299.00
- **Screenshot:** Take full subscriptions list
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 5: Verify Usage Meters (5 Metrics)
- **Action:** Scroll to "Usage Meters" section → Verify 5 meters: API Screenings, Dashboard Seats, SDK Calls, iFrame Lookups, Dataset Fetches
- **Expected Result:**
  - API Screenings: 847,500 / 1,000,000 (84.75%), Overage = $0.05/call
  - Dashboard Seats: 9 / 10 (90%), Overage = $25/seat
  - SDK Calls: 42,000 / 100,000 (42%), Overage = $0.01/call
  - iFrame Lookups: 5,230 / 25,000 (20.92%), Overage = $0.02/lookup
  - Dataset Fetches: 128 / 500 (25.6%), Overage = $1.00/fetch
- **Verify:** All 5 meters visible, percentages correct, no overflow
- **Screenshot:** Take usage meters section
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 6: Test Invalid Promo Code
- **Action:** Scroll to "Promo Code" field → Enter code: "FAKE123" → Click "Apply Promo Code" → Wait 2 seconds
- **Expected Result:** Error message: "Invalid promo code. Please check and try again." in red toast. Field remains filled with "FAKE123". No discount applied.
- **Verify:** Error message visible 5 seconds, field not cleared, no unexpected API errors
- **Screenshot:** Take error notification
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 7: Test Valid Promo Code (100% Discount)
- **Action:** Clear promo code field → Enter code: "AMLIQ_FREE" → Click "Apply Promo Code" → Wait 2 seconds
- **Expected Result:** Success message: "Promo code applied! You now have 100% discount." Green toast. Price changes from "$299.00" to "$0.00". Badge shows "AMLIQ_FREE - 100% off".
- **Verify:** Success visible, price updated to $0.00, badge shows promo code, changes instant
- **Screenshot:** Take success notification and updated billing info
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 8: Add New Product Subscription
- **Action:** Click "Add Product" button → Select "SDK Professional" → Click "Confirm"
- **Expected Result:** Modal closes. New row: "SDK Professional | Professional | Active | 2026-04-26 | $149.00/month". Total increases to $448.00 (or $0.00 with discount).
- **Verify:** Product appears with correct tier and price, total updates, no duplicates
- **Screenshot:** Take updated subscriptions list
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 9: Upgrade API Plan
- **Action:** Find "API Screening" row → Click "Upgrade" → Select "Enterprise" → Review pricing change → Click "Confirm Upgrade"
- **Expected Result:** API Screening updates to "Enterprise" ($499.00). Prorated charge modal shows: "Current Period Adjustment: $13.33 (4 days remaining). Next billing: $498.67." Click "Accept Charges".
- **Verify:** Tier updated, prorated calculation visible, total reflects new tier
- **Screenshot:** Take upgrade confirmation and prorated modal
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 10: Verify Prorated Charge Calculation
- **Action:** Review prorated charge modal → Verify calculation: ($499 - $99) × (4/30) ≈ $13.33
- **Expected Result:** Calculation correct. Modal explains: "Prorated for 4 days remaining out of ~30-day cycle"
- **Verify:** Math accurate, no rounding errors > $0.01, calculation explained clearly
- **Screenshot:** Already captured in Step 9
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 11: Check Invoice List
- **Action:** Scroll to "Invoices" section → Verify table: Invoice #, Date, Amount, Status, Action → Click recent invoice
- **Expected Result:** Invoice list shows 3+ invoices. Most recent: "INV-2026-047 | 2026-03-26 | $299.00 | Paid | Download PDF"
- **Verify:** Invoices in reverse chronological order, amounts match subscriptions, all status = Paid
- **Screenshot:** Take invoice list
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 12: Download Invoice PDF
- **Action:** Click "Download PDF" on most recent invoice → Wait 2 seconds
- **Expected Result:** PDF downloads with filename "AMLIQ_Invoice_INV-2026-047.pdf". Contains invoice number, date, company, itemized charges, total amount, payment method, due date. File size > 50KB.
- **Verify:** File downloads successfully, readable PDF, correct filename
- **Screenshot:** Take after download confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 13: Add New Dashboard Seat
- **Action:** Find "Dashboard" product → Click "Manage Seats" → Click "Add Seat" → Enter james.smith@complytech.com → Select role: "Analyst" → Click "Confirm Add"
- **Expected Result:** Modal confirms: "Seat added for james.smith@complytech.com (Analyst role)". Seat count updates from 9/10 to 10/10. Invitation email sent.
- **Verify:** Seat count increments, new email appears in list, modal closes
- **Screenshot:** Take seat added confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 14: Remove Dashboard Seat
- **Action:** Click "Manage Seats" again → Find james.smith@complytech.com → Click "Remove Seat" → Confirm in warning dialog
- **Expected Result:** Seat removed. Message: "Seat removed. Your current seats: 9/10". User receives removal email. Usage Meters updates back to 9/10.
- **Verify:** Seat count decrements, removed user gone from list
- **Screenshot:** Take after removal confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 15: Verify Seat Count Update
- **Action:** Close modal → Check Usage Meters for "Dashboard Seats"
- **Expected Result:** Dashboard Seats shows "9 / 10 (90%)" with green progress bar
- **Verify:** Seat count matches list, percentage calculated correctly
- **Screenshot:** Take usage meters
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 16: Check Usage History Charts
- **Action:** Scroll to "Usage History" section → Verify 5 line charts with 30-day data
- **Expected Result:** All 5 charts render with data points, trend lines visible, legend shows metric name, charts interactive (hover shows tooltip)
- **Verify:** Charts load < 2 seconds, all data points visible, tooltips work
- **Screenshot:** Take usage history section
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 17: Test Payment Alert for Past Due Status
- **Action:** Go to Settings → Change next billing to yesterday → Navigate back to Billing
- **Expected Result:** Red alert appears: "⚠️ Payment Due: Your payment is past due..." Dismissible with X, reappears on reload.
- **Verify:** Alert is prominent, provides clear action, accurate message
- **Screenshot:** Take alert notification
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 18: Navigate to Billing Customer Portal
- **Action:** Click "Manage in Customer Portal" → Wait 2 seconds as new tab opens
- **Expected Result:** New tab opens to payment processor portal with billing history, payment methods, subscription details. URL differs from AMLIQ.
- **Verify:** New tab opens successfully, portal loads completely, no 404 errors
- **Screenshot:** Take customer portal page
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 19: Review Billing Cycle Dates
- **Action:** Return to AMLIQ Billing page → Check "Current Plan" for Billing Cycle dates
- **Expected Result:** Card displays: "Billing Cycle: March 26, 2026 - April 25, 2026 | Days Remaining: 30 | Next Renewal: April 26, 2026"
- **Verify:** Dates formatted consistently, days remaining accurate, renewal matches next billing
- **Screenshot:** Already captured in earlier steps
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 20: Cancel Subscription
- **Action:** On Current Plan, click "Cancel Plan" → Read warning → Click "Yes, Cancel Subscription" → Select reason from dropdown
- **Expected Result:** Modal: "Plan cancelled at end of billing cycle (April 25, 2026)". Status = "Cancellation Scheduled". Confirmation email sent.
- **Verify:** Status updated, confirmation email verified, final billing date shown
- **Screenshot:** Take cancellation confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 21: Verify Cancellation Confirmation
- **Action:** Refresh page (Ctrl+R) → Check Current Plan status → Verify cancellation email
- **Expected Result:** Status shows "Cancellation Scheduled" with message "Subscription ends April 25, 2026." Email received with cancellation confirmation.
- **Verify:** Status persists after reload, email within 1 minute
- **Screenshot:** Take status confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

### Step 22: Reactivate Subscription
- **Action:** Click "Reactivate Plan" on Current Plan card → Click "Confirm Reactivation"
- **Expected Result:** Status changes to "Active". Message: "Plan reactivated. Charges resume on next billing cycle." Reactivation email sent.
- **Verify:** Status updates immediately, email received
- **Screenshot:** Take reactivation confirmation
- **Checkbox:** ☐ PASS / ☐ FAIL

## Test Summary

**Total Steps:** 22

**Pass Criteria:**
- All 22 steps complete with no critical errors
- Billing calculations accurate (prorating, totals, overage costs)
- Promo code validation works (invalid rejected, valid applied)
- Seat management updates reflected in real-time
- All invoices downloadable as valid PDFs
- Payment alerts display appropriately
- Cancellation/reactivation workflow successful
- No console JavaScript errors
- Page loads within 3 seconds consistently

**Notes:**
- Billing data should match backend invoice records
- All timestamps in UTC or configured timezone
- Currency USD with $ symbol and .00 decimals
- Promo code discount zeroes out billing immediately
