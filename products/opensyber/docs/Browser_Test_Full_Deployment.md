# Full Agent Deployment Flow — Browser Test

**URL:** https://opensyber.cloud
**Test Date:** March 27, 2026
**Goal:** Test the complete user journey from sign-in through agent deployment

---

## Flow 1: Sign In with New Auth System

### Step 1: Open sign-in page
**Navigate to:** `https://opensyber.cloud/sign-in`

**Verify:**
- [ ] Page loads with branded left panel ("WELCOME BACK")
- [ ] 4 OAuth buttons: Google, GitHub, Microsoft, LinkedIn
- [ ] No Clerk components visible (no Clerk branding or powered-by text)
- [ ] "No account? Sign in above — we'll create one automatically."

**Screenshot:** Sign-in page

### Step 2: Sign in with Google
- [ ] Click "Continue with Google"
- [ ] Google OAuth consent screen appears
- [ ] Select your account
- [ ] Redirects to `/dashboard`
- [ ] No errors in console

### Step 3: Verify dashboard loads
- [ ] Dashboard heading visible
- [ ] Sidebar navigation renders
- [ ] User avatar from Google visible in sidebar (bottom section)
- [ ] User name visible
- [ ] User email visible
- [ ] Plan shows "Free" or appropriate plan

**Screenshot:** Dashboard with user avatar

---

## Flow 2: Profile Page

### Step 4: Navigate to profile
**Navigate to:** `https://opensyber.cloud/dashboard/profile`

**Verify:**
- [ ] Profile card: avatar, name, email, "Signed in via Google"
- [ ] Account details: Plan, Member Since, User ID, Referral Code
- [ ] Connected Accounts section: Google shows "Connected", others show "Connect" button
- [ ] Sign Out section with red button

**Screenshot:** Profile page

### Step 5: Test account linking (optional)
- [ ] Click "Connect" on GitHub
- [ ] GitHub OAuth flow
- [ ] Redirects back to profile
- [ ] GitHub now shows "Connected"

---

## Flow 3: Pricing & Checkout

### Step 6: Navigate to pricing
**Navigate to:** `https://opensyber.cloud/pricing`

**Verify:**
- [ ] 5 tiers displayed with correct prices
- [ ] Paid plan buttons show LemonSqueezy checkout URLs (NOT "Go to Dashboard")
- [ ] Inspect a button — URL contains `finsavvy.lemonsqueezy.com`
- [ ] URL contains `checkout[discount_code]=A3OTE0NW`
- [ ] URL contains `checkout[email]` with your email

**Screenshot:** Pricing page with checkout URLs

### Step 7: Complete checkout (Personal plan $49)
- [ ] Click Personal plan button
- [ ] LemonSqueezy checkout loads
- [ ] Coupon A3OTE0NW pre-applied (total $0.00)
- [ ] Enter test card: `4242 4242 4242 4242`, exp `12/29`, CVC `123`
- [ ] Submit payment
- [ ] Success screen
- [ ] Redirects to `/dashboard?payment=success`

**Screenshot:** LemonSqueezy checkout with $0.00 total

### Step 8: Verify subscription activated
- [ ] Navigate to `/dashboard/settings`
- [ ] Subscription card shows "Personal" plan
- [ ] Shows $49/mo price
- [ ] Instance limit and features displayed
- [ ] "Upgrade plan" link visible

**Screenshot:** Settings with Personal plan

---

## Flow 4: Deploy Agent Instance

### Step 9: Deploy instance
**Navigate to:** `https://opensyber.cloud/dashboard`

- [ ] Click "Deploy Instance" button
- [ ] Form opens
- [ ] Enter name: `Production Agent`
- [ ] Select region: `EU Central (Falkenstein)`
- [ ] Click Deploy/Submit

**Wait for provisioning:**
- [ ] Instance card shows "Provisioning..." status
- [ ] Status transitions to "Installing..."
- [ ] Status transitions to "Running" (may take 30-60 seconds)
- [ ] Green "Running" badge visible

**Screenshot:** Instance card with "Running" status

### Step 10: Verify instance in settings
**Navigate to:** `https://opensyber.cloud/dashboard/settings`

- [ ] Instance card shows: name "Production Agent", region "EU Central (Falkenstein)"
- [ ] Hostname assigned (e.g., `agent-xxxx.opensyber.cloud`)
- [ ] Gateway Token: "Configured"
- [ ] Instance ID visible

**Screenshot:** Settings with instance details

---

## Flow 5: Credential Vault

### Step 11: Add a secret
- [ ] Scroll to "Credential Vault" section
- [ ] Enter key: `OPENAI_API_KEY`
- [ ] Enter value: `sk-test-12345`
- [ ] Click Add/Save
- [ ] Secret appears in list with masked value
- [ ] Secret count incremented

---

## Flow 6: Install a Skill

### Step 12: Browse marketplace
**Navigate to:** `https://opensyber.cloud/dashboard/marketplace`

- [ ] Skill cards load
- [ ] Click a skill (e.g., "Secret Scanner")
- [ ] Skill detail page loads

### Step 13: Install skill
- [ ] Click "Install" button
- [ ] Select target instance from dropdown
- [ ] Confirm installation
- [ ] Skill appears in `/dashboard/skills` with "Active" status

**Navigate to:** `https://opensyber.cloud/dashboard/skills`
- [ ] Installed skill visible
- [ ] Status: Active

---

## Flow 7: Security Monitoring

### Step 14: Check security dashboard
**Navigate to:** `https://opensyber.cloud/dashboard/security`

- [ ] Security dashboard loads
- [ ] Metrics or "waiting for data" state

### Step 15: Check vulnerabilities
**Navigate to:** `https://opensyber.cloud/dashboard/security/vulnerabilities`

- [ ] Vulnerability scanner results or empty state

### Step 16: Check logs
**Navigate to:** `https://opensyber.cloud/dashboard/logs`

- [ ] Audit log page loads
- [ ] Agent activity entries visible (if agent is running)

---

## Flow 8: Onboarding Checklist

### Step 17: Verify onboarding progress
**Navigate to:** `https://opensyber.cloud/dashboard/getting-started`

- [ ] Checklist shows progress
- [ ] "Deploy agent" step should be checked (we deployed in Step 9)
- [ ] Integration guide links work

---

## Flow 9: Growth Kit & Embeds

### Step 18: Check Growth Kit
**Navigate to:** `https://opensyber.cloud/dashboard/settings`

- [ ] Scroll to "Growth Kit" section
- [ ] ScorecardShareCard renders
- [ ] BadgeEmbed shows embeddable code
- [ ] Copy button works

---

## Flow 10: Instance Deletion (Danger Zone)

### Step 19: Delete instance (if testing complete)
- [ ] Scroll to "Danger Zone" in settings
- [ ] Click "Delete Instance"
- [ ] Confirmation dialog appears
- [ ] Confirm deletion
- [ ] Instance removed from dashboard
- [ ] Dashboard shows "No instances" empty state

---

## Flow 11: Sign Out & Re-Sign In

### Step 20: Sign out
- [ ] Go to `/dashboard/profile`
- [ ] Click "Sign Out" button
- [ ] Redirected to homepage
- [ ] Visit `/dashboard` → redirected to `/sign-in`

### Step 21: Sign in with different provider
- [ ] Go to `/sign-in`
- [ ] Click "Continue with LinkedIn" (or GitHub)
- [ ] OAuth flow completes
- [ ] Redirects to `/dashboard`
- [ ] Same user data visible (account linking via same email)

**Screenshot:** Dashboard after LinkedIn sign-in (same account)

---

## Flow 12: API Verification

### Step 22: API health
```
curl https://api.opensyber.cloud/
```
- [ ] Returns `{"name":"OpenSyber API","version":"0.3.0"}`

### Step 23: Auth enforcement
```
curl https://api.opensyber.cloud/api/user
```
- [ ] Returns 401 Unauthorized

### Step 24: Webhook security
```
curl -X POST https://api.opensyber.cloud/webhooks/lemonsqueezy -H "Content-Type: application/json" -d '{}'
```
- [ ] Returns 401 "Missing signature"

---

## Test Results

| Flow | Steps | Result |
|------|-------|--------|
| 1. Sign In (Auth.js) | 1-3 | |
| 2. Profile Page | 4-5 | |
| 3. Pricing & Checkout | 6-8 | |
| 4. Deploy Instance | 9-10 | |
| 5. Credential Vault | 11 | |
| 6. Install Skill | 12-13 | |
| 7. Security Monitoring | 14-16 | |
| 8. Onboarding Checklist | 17 | |
| 9. Growth Kit | 18 | |
| 10. Instance Deletion | 19 | |
| 11. Sign Out & Re-Sign In | 20-21 | |
| 12. API Verification | 22-24 | |

**Total Steps:** 24
**Critical Path:** Steps 1 → 3 → 6 → 7 → 9 → 10 (sign in → dashboard → pricing → checkout → deploy → verify)

---

## Notes

- **Step 7 (checkout):** Creates a real $0 subscription. Cancel in LemonSqueezy dashboard after testing.
- **Step 9 (deploy):** Triggers real Hetzner server provisioning. Delete after testing to avoid charges.
- **Step 5 (account linking):** After connecting GitHub, you can sign in with either Google or GitHub — same account.
- **Step 19 (delete instance):** Only do this after all testing is complete. Irreversible.
