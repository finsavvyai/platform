# Microsoft Cloud Partner Program — MPN enrollment guide

> **Who runs this:** you (Shachar). Microsoft verify legal entity + phone + email against external systems; impossible to automate.
> **Time:** ~15 min active work, 24-72h verification wait.
> **Cost:** $0. Free "Network" tier unlimited.
> **Unlocks:** green "Verified Publisher" badge on consent screens. Removes the yellow "End users cannot grant consent to newly registered multitenant apps without verified publishers" warning across OpenSyber + TokenForge + every future Entra app in the `infofinsavyai.onmicrosoft.com` tenant.

---

## Why this matters

Since November 2020, Microsoft blocks users in **other tenants** from self-consenting to multi-tenant apps unless publisher is verified. Current status for OpenSyber:

- ✓ Your own tenant users can sign in
- ✓ Personal MSAs (`@outlook.com`, `@hotmail.com`) can sign in
- ✓ Other Entra orgs work **if their global admin pre-consents**
- ✗ Other Entra org end-users cannot self-consent → signin rejected with "admin approval required"

External-org users are future paying customers. Blocking them loses deals. MPN ID fix this permanently.

---

## Pre-checks before applying

Failing any of these will reject your MPN application and force a re-submission (+24-72h delay).

### 1. Business email on owned domain

Microsoft prefer `shachar@finsavvyai.com` or `shachar@opensyber.cloud` over `@gmail.com`. Gmail *technically* accepted for sole proprietors but slows verification.

**Fix now (5 min, free):**
- Cloudflare dashboard → `finsavvyai.com` (or `opensyber.cloud`) → Email → **Email Routing → Enable**
- Add rule: `shachar@finsavvyai.com` → forward to → `shacharsol@gmail.com`
- Add MX + TXT records (Cloudflare auto-detects on Enable)
- Verify forwarding by sending test email

### 2. Legal business entity registered

Microsoft need a registered legal name that match a government registry. Options:

| Entity | Country | Setup time | Cost |
|---|---|---|---|
| **עוסק מורשה** (Israeli sole proprietor) | IL | ~1 day online | ~₪200/year |
| **עוסק פטור** | IL | ~1 day | ₪0 |
| **LLC** | US | 1-2 weeks | $50-500 |
| **Ltd** | UK | 1 day online | £12 |

If Finsavvy Technologies already registered, skip. If not: a sole proprietor in Israel is the fastest path and enough for Microsoft verification.

### 3. Phone reachable

Microsoft auto-call or SMS for verification within 48h. Have voicemail set up. Answer foreign numbers during business hours (UTC+2 Israel).

### 4. Consistent naming

All three must exactly match:
- Legal entity registry name
- Partner Center "Legal business name" field
- Publisher domain WHOIS registrant (or enable privacy consistently)

Mismatches trigger manual review → adds 1-3 business days.

---

## Enrollment steps

### Step 1 — sign in to Partner Center

URL: https://partner.microsoft.com/dashboard

Sign in as the **global admin** of the Entra tenant that hosts the apps. For you: `info@finsavvyai.com` (same UPN you verified is global admin in earlier screenshot). Pick **"Sign in with Microsoft Entra ID"** route, not MSA — MSA shell only allow read-only work.

### Step 2 — fix User management profile

If prompted for first/last name (observed earlier): enter **real person name** — `Shachar` / `Solomon`. Do not leave company name parsed into first+last — Microsoft reject that at verification.

### Step 3 — Legal info

Left nav: **Organization profile → Legal info**.

**Company** section:

| Field | Value |
|---|---|
| Legal business name | exact registry name (e.g. `Finsavvy Technologies` or sole-prop name) |
| Country/region | Israel |
| Address | registered business address |
| Phone | reachable phone |
| Website | `https://opensyber.cloud` or `https://finsavvyai.com` |

**Primary contact** section:

| Field | Value |
|---|---|
| First name | `Shachar` |
| Last name | `Solomon` |
| Work email | `shachar@finsavvyai.com` if email routing set, else `info@finsavvyai.com` |
| Phone | direct line |

Submit. Banner: **"Submitted for review"**.

### Step 4 — enroll Microsoft AI Cloud Partner Program

While Legal info verify runs (24-72h), submit program enrollment in parallel.

Left nav: **Programs → Microsoft AI Cloud Partner Program** (formerly MPN/MCPP) → **Enroll / Get started**.

Accept **Microsoft Partner Agreement (MPA)**. Tier = **Network** (free).

Status → Pending. Auto-flip to Active once Legal info verifies.

### Step 5 — wait

Microsoft email you when verified. Timeline:

- **Best case:** 4-8h (automated checks pass, no manual review)
- **Typical:** 24-48h
- **Worst case:** 5-7 business days if manual review triggered by name mismatch or address ambiguity

### Step 6 — copy MPN ID

Left nav: **Account settings → Identifiers**. Page now shows:

| Identifier | Format | Use |
|---|---|---|
| **MPN ID (PartnerID)** | 7-digit number, e.g. `4567890` | paste into Entra apps |
| Microsoft Entra ID tenant ID | GUID | already known |

Copy MPN ID.

### Step 7 — associate MPN with OpenSyber app

Portal: https://entra.microsoft.com → **App registrations → OpenSyber → Branding & properties**

Scroll to yellow warning **"End users cannot grant consent..."** → **Add MPN ID to verify publisher** → paste 7-digit MPN ID → **Verify and save**.

Green **"Verified Publisher"** badge appears within seconds.

### Step 8 — associate MPN with TokenForge app

Repeat Step 7 for TokenForge. Same MPN ID. One-click reuse.

Any future Entra apps created under the same tenant also reuse the same MPN ID.

### Step 9 — verify consent screen

Incognito → `https://opensyber.cloud/sign-in` → Microsoft → first-time signin. Consent screen should show:

- Publisher: `<Your Legal Business Name>` with **blue verified checkmark**
- No yellow "unverified" warning

---

## Blockers + workarounds

| Problem | Cause | Fix |
|---|---|---|
| Email domain rejected | `@gmail.com` flagged as personal | Set up Cloudflare Email Routing, use `@finsavvyai.com` |
| Legal entity not found | Microsoft can't query Israeli registry | Manual review, 3-5 business days. No action needed except wait |
| Phone never rings | Microsoft use US number fallback | Check carrier for int'l call block, whitelist Microsoft numbers |
| "Tenant mismatch" on MPN associate | Partner Center linked to different Entra tenant | Account settings → Tenants → associate correct tenant (you confirmed same tenant earlier, should be fine) |
| Multi-day delay | Manual review by Microsoft compliance | No action. Email support only after 7 business days |

---

## Timeline budget

| Item | Today | +1 day | +3 days | +7 days |
|---|---|---|---|---|
| Set up Cloudflare Email Routing | ✓ | | | |
| Register sole proprietor (if missing) | submit | approved | | |
| Legal info submitted | | ✓ | | |
| Microsoft AI Cloud Partner enroll | | ✓ | | |
| Verification complete | | | ✓ (typical) | ✓ (worst) |
| MPN ID copied | | | ✓ | |
| Entra apps publisher-verified | | | ✓ | |
| External-tenant users can self-consent | | | ✓ | |

---

## Parallel work while waiting

MPN verification is blocking for external-org self-consent only. Signin from your tenant + MSAs work fine now. So during 24-72h wait:

1. Do TokenForge Entra setup (see `tokenforge-entra-setup.md` in this dir)
2. Read three competitive-research files as they land in `competitive/`
3. Microsoft real-account smoke test (manual, 30 sec — confirm end-to-end)
4. Build publisher-verified badge UI into sign-in page so customers see trust signal

---

## Checklist

- [ ] Email routing set up on `finsavvyai.com` or `opensyber.cloud`
- [ ] Legal entity registered (if needed)
- [ ] Partner Center signed in as Entra global admin (not MSA)
- [ ] User profile fixed (real first + last name)
- [ ] Legal info submitted
- [ ] Microsoft AI Cloud Partner Program enrolled
- [ ] Verification email received
- [ ] MPN ID copied from Identifiers page
- [ ] MPN associated with OpenSyber app → green badge
- [ ] MPN associated with TokenForge app → green badge
- [ ] Incognito consent screen shows verified publisher
