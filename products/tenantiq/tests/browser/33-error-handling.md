# Error Handling & Edge Cases Tests

> 5 tests | Priority: P3

## Prerequisites
- Signed in as admin user
- DevTools console open

## Tests

| # | Test | Steps | Expected | Status |
|---|------|-------|----------|--------|
| 1 | No token sync | (With expired token) Click any sync button | Toast: "Please sign out and sign in again" | |
| 2 | Empty tenant | Switch to a tenant with no data | Empty states with sync CTAs on all pages | |
| 3 | Page reload | Reload any page mid-load | Page recovers and loads correctly | |
| 4 | 404 handling | Navigate to /nonexistent | Shows error page (not blank screen) | |
| 5 | Console errors | Open DevTools console, navigate all pages | No red JavaScript errors (ignore SES/lockdown) | |
