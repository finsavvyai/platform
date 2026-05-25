# F10: Plan Upgrade & Downgrade

**Objective:** Verify plan change workflow with prorated charges and usage limit updates.
**Prerequisites:** Authenticated user with active subscription, navigate to `/billing`

## Test Steps

1. **Navigate to Plan Change:** Navigate to `/billing`, locate "API Starter" subscription, click "Change Plan", verify redirect to plan comparison page showing all 3 tiers with current plan highlighted
2. **Select Higher Tier:** Click "Professional" plan card, verify selection highlighted, click "Upgrade to Professional"
3. **Upgrade Modal—Prorated Charges:** Verify modal "Confirm Plan Upgrade" showing: Current Plan (Starter), Refund for unused time (e.g., "-$116.35"), New Plan (Professional), Prorated charge (e.g., "+$1,382.65"), Net charge today (e.g., "$1,266.30"), next billing date. Verify calculation correct
4. **Confirm Upgrade:** Click "Confirm Upgrade", verify loading indicator, verify success message "Plan upgraded successfully" with new plan details and new usage limits
5. **Verify in Dashboard:** Close modal, verify redirect to `/billing`, subscription card shows: plan "Professional", price "$1,499/month", status "Active"
6. **Verify Usage Limit Increased:** Navigate to screening page, verify usage limit increased from 1,000 to 10,000 API calls. Navigate to dashboard usage meter—verify new max 10,000
7. **Verify Invoice:** Navigate back to `/billing`, verify new invoice in history: description "Plan Upgrade - Starter to Professional", amount "$1,266.30", status "Paid", date "Today". Click "Download"—verify PDF includes upgrade details
8. **Test Downgrade:** Click "Change Plan" on Professional subscription, click "Starter" (downgrade), verify warning message: "Downgrading will reduce your usage limits. API calls limit will drop from 10,000 to 1,000"
9. **Confirm Downgrade:** Click "Downgrade to Starter", verify modal showing credit (e.g., "+$349.65" for unused Professional time), net credit "$233.30". Click "Confirm", verify success "Plan downgraded". Verify subscription shows "Starter" again, usage limit reduced to 1,000
10. **Downgrade Credit:** Verify credit appears in account balance or next invoice (credit reduces next charge)
11. **Cancellation:** Click "Change Plan", scroll bottom, verify "Cancel Subscription" link. Click, verify confirmation modal with reason options (Service Quality, Cost, Switching Provider, etc.), optional feedback field. Select reason, enter comment, click "Confirm". Verify success "Subscription canceled", status shows "Canceled" with "Active until April 26, 2026", "Reactivate" button available
12. **Reactivate:** Click "Reactivate", verify "Reactivate this subscription?" confirmation. Click "Confirm", verify subscription returns to "Active" status
13. **Multiple Subscriptions:** Verify user has multiple subscriptions (API, Dashboard, SDK). Upgrade only SDK plan, verify other subscriptions unchanged
14. **Mobile (375px):** Resize to mobile, verify plan comparison cards stack vertically, all details readable, "Upgrade" button full-width and touchable, modal content readable

## Validation

- Prorated charges calculated correctly
- Upgrade completes successfully and immediately
- Downgrade shows warning and completes
- Cancellation works with end-date confirmation
- Reactivation restores subscription
- Other subscriptions unaffected
- Usage limits update after plan change
- Invoices reflect all charges correctly

## Expected Result

Plan upgrade/downgrade workflows complete successfully with accurate prorated charges, warning messages for downgrades, cancellation with end-date, and reactivation support.

---

*F10 | Plan Upgrade | 2026-03-26*
