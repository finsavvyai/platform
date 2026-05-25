# TenantIQ Mobile — Manual Setup Guide

Step-by-step instructions for the user-facing manual tasks needed to complete the mobile rollout. The code is already deployed. These steps unblock VAPID push delivery, App Store submission, and Play Store submission.

**Estimated total time:** 4-8 hours active work + 3-7 days waiting on Apple/Google approval.

## ⚠ Current shipping plan (2026-04-26)

Apple Developer enrollment is **deferred** (blocker noted; resume target ~2026-05-03 — see routine `Resume Apple Developer enrollment` at https://claude.ai/code/routines).

**Active path:**
1. ✅ **PWA on iOS** — already live at app.tenantiq.app. iOS Safari users get an install hint banner ("Add to Home Screen") which enables Web Push since iOS 16.4.
2. 🟡 **Android via Google Play** — Capacitor app ready, blocked on Play Console approval + Firebase project. See §3, §4, §6 below.
3. 🔒 **iOS via App Store** — deferred until Apple resolves. See §2 + §5 + §7 (iOS half) when ready.

If your Apple block resolves earlier, just resume from §2 — nothing about the Android path needs to change.

---

## 1. Generate VAPID keys (5 min)

Required for: web push delivery on PWA + Android (FCM uses VAPID too).

### Step 1.1 — Generate the keypair

```sh
cd apps/api
npx web-push generate-vapid-keys --json
```

Output looks like:
```json
{
  "publicKey": "BJxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "privateKey": "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy"
}
```

### Step 1.2 — Convert private key to JWK

The deployed code (`apps/api/src/lib/web-push.ts`) expects the private key in **JWK format**. The `web-push` CLI gives you a raw base64url string. Convert it:

```sh
# Install jose CLI helper (one-time)
npm install -g @auth/core jose

# Or use this Node snippet:
node -e '
const { publicKey, privateKey } = require("./vapid.json");
const pubBytes = Buffer.from(publicKey, "base64url");
// First byte is 0x04 (uncompressed), then 32 bytes x, then 32 bytes y
const x = pubBytes.subarray(1, 33).toString("base64url");
const y = pubBytes.subarray(33, 65).toString("base64url");
const jwk = { kty: "EC", crv: "P-256", d: privateKey, x, y };
console.log(JSON.stringify(jwk));
'
```

Save the output of the `web-push generate-vapid-keys --json` command to `vapid.json` first, then run the snippet. It prints the JWK JSON string.

### Step 1.3 — Set as Wrangler secrets

```sh
cd apps/api

# Public key — raw base64url string from step 1.1
npx wrangler secret put VAPID_PUBLIC_KEY
# Paste: BJxxxxxxxxxx... (no quotes)

# Private key — JWK JSON from step 1.2
npx wrangler secret put VAPID_PRIVATE_KEY
# Paste: {"kty":"EC","crv":"P-256","d":"...","x":"...","y":"..."}
```

### Step 1.4 — Add VAPID_CONTACT to wrangler.toml

Edit `apps/api/wrangler.toml`, in the `[vars]` section:

```toml
[vars]
VAPID_CONTACT = "mailto:support@tenantiq.app"
```

### Step 1.5 — Deploy

```sh
cd apps/api
npx wrangler deploy
```

### Step 1.6 — Verify

```sh
curl https://api.tenantiq.app/api/push/vapid-key
# Expected: {"publicKey":"BJxxx..."}
# If 503: secrets not loaded — re-run step 1.3 or check wrangler logs.
```

The daily reminder routine `trig_01FF5KPW9oL7LrNvMn2fTyWq` will detect the change and tell you to disable itself. Do that at https://claude.ai/code/routines.

---

## 2. Apple Developer Program enrollment (~$99 + 24-72hr)

Required for: P2.4 iOS Xcode signing + P2.6 App Store submission.

### Step 2.1 — Apple ID prep

1. Go to https://appleid.apple.com
2. Sign in with the Apple ID you'll use for the developer account (use a company email, not personal)
3. Confirm 2FA is enabled (required for Developer Program)
4. Confirm phone + recovery contact set

### Step 2.2 — Get a D-U-N-S Number (free, ~24-48hr)

Required for **Organization** enrollment (recommended for B2B / MSP credibility):

1. Go to https://developer.apple.com/enroll/duns-lookup/
2. Search for your registered company name
3. If exists: note the D-U-N-S Number
4. If not: click "I need a D-U-N-S Number" — fills out a form, Apple's D&B partner emails the number in ~24-48hr

The legal entity name in your D-U-N-S record MUST match exactly the name you'll use in Apple enrollment. Common gotcha: "TenantIQ Inc." vs "TenantIQ Inc" (period matters).

### Step 2.3 — Enroll

1. Go to https://developer.apple.com/programs/enroll/
2. Pick **Organization** (not Individual — Individual hides company name on App Store, blocks some MSP procurement)
3. Fill out:
   - Legal entity name (matches D-U-N-S exactly)
   - D-U-N-S number
   - Phone number for verification call
   - Authorized signer (you, if you have signing authority)
4. Pay $99 USD with credit card
5. Wait for "Welcome to the Apple Developer Program" email — typically 1-3 business days, can be 7

### Step 2.4 — Capture identifiers

Once approved, log into https://developer.apple.com/account and note:

- **Team ID** — 10-character alphanumeric (e.g. `ABC123XYZ9`). Top right of the dashboard.
- **Bundle ID:** create one at Identifiers → App IDs → "+" → choose `app.tenantiq.app` (or `com.<your-org>.tenantiq` if `app.tenantiq.app` is taken). Enable capabilities: **Push Notifications**, **Sign in with Apple**, **Associated Domains** (for universal links).

### Step 2.5 — Generate APNs Key (for push)

1. Certificates, Identifiers & Profiles → Keys → "+"
2. Name: "TenantIQ APNs"
3. Check **Apple Push Notifications service (APNs)**
4. Continue → Download the `.p8` file
5. **Save the Key ID** shown (e.g. `ABCD123XYZ`)

This `.p8` file + Key ID + Team ID + Bundle ID is what you'll send me to wire P2.4.

---

## 3. Google Play Console enrollment (~$25 + 1-3 days)

Required for: P2.5 Android signing + P2.6 Play Store submission.

### Step 3.1 — Google account prep

1. Use a Google Workspace account if you have one (gives the Play Console "Organization" status). Personal Gmail also works but Play Console asks more identity verification later.
2. Confirm 2FA enabled

### Step 3.2 — Sign up

1. Go to https://play.google.com/console/signup
2. Pick **Organization** (not Personal)
3. Fill out:
   - Developer name: "TenantIQ" or your legal entity
   - Country
   - Phone (used for SMS verification later)
4. Pay $25 USD (one-time)
5. Complete identity verification (passport/driver's license upload — usually instant for orgs that have D&B records)
6. Complete tax form (W-9 for US, W-8BEN for foreign)

### Step 3.3 — Create app

1. In Play Console: All apps → Create app
2. Default language: English (US)
3. App name: TenantIQ
4. App or game: App
5. Free or paid: Free
6. Accept policies
7. **Note the package name** when you create the first internal release (you'll set it in P2.5): `app.tenantiq.app` (must match Capacitor `appId`)

### Step 3.4 — Capture identifiers

- **Package name** — matches Capacitor `appId` (`app.tenantiq.app`)
- **App ID in Play Console** — auto-assigned, looks like an integer ID

---

## 4. Firebase Cloud Messaging (FCM) setup (10 min)

Required for: Android push delivery (P2.3 already installed `@capacitor/push-notifications`, but Android needs FCM credentials).

### Step 4.1 — Create Firebase project

1. Go to https://console.firebase.google.com
2. Create new project — name it "TenantIQ" or "tenantiq-mobile"
3. Disable Google Analytics if you don't need it (simpler GDPR posture)

### Step 4.2 — Add Android app

1. Project overview → "+" → Android
2. Android package name: `app.tenantiq.app` (matches Capacitor + Play Console)
3. App nickname: "TenantIQ Android"
4. SHA-1 fingerprint: skip for now (will add later when you have a release keystore in P2.5)
5. **Download `google-services.json`** — save it for P2.5

### Step 4.3 — Enable Cloud Messaging

1. Build → Cloud Messaging → enable
2. Project Settings (gear icon) → Cloud Messaging tab → note **Server key** (legacy) and **Sender ID**

### Step 4.4 — (For iOS push too — optional)

If you want unified push handling via Firebase for both iOS and Android:

1. Same Firebase project → "+" Add iOS app
2. iOS bundle ID: `app.tenantiq.app`
3. Download `GoogleService-Info.plist`
4. Upload your APNs `.p8` key from step 2.5 in Firebase Project Settings → Cloud Messaging → Apple app configuration

This routes iOS push through Firebase too, simplifying backend code. Skip if you'd rather hit APNs directly.

---

## 5. P2.4 — iOS Xcode config (after Apple approves)

Send me before starting:
- Apple Team ID (10 chars)
- Apple Bundle ID
- APNs `.p8` key file + Key ID

Or do it yourself:

```sh
cd apps/web
npm run build:mobile
npx cap sync ios
npx cap open ios   # opens Xcode
```

In Xcode:
1. Click the App project in left sidebar → click "App" target
2. **Signing & Capabilities** tab:
   - Team: select your Apple Developer team
   - Bundle Identifier: `app.tenantiq.app`
   - "Automatically manage signing" — checked
   - "+ Capability" → add **Push Notifications**
   - "+ Capability" → add **Background Modes** → check `Remote notifications` and `Background fetch`
   - "+ Capability" → add **Sign In with Apple** (optional)
   - "+ Capability" → add **Associated Domains** (optional, for `applinks:tenantiq.app`)
3. **General** tab:
   - Display Name: TenantIQ
   - Version: 1.0.0
   - Build: 1
4. Run on a simulator (⌘R) to verify the WebView loads from `https://api.tenantiq.app`

Test push on a real device (push doesn't work on simulator):
1. Connect iPhone via USB → trust device
2. Select device in Xcode top bar → ⌘R
3. App opens → trigger an alert in production (or have someone do it) → push notification appears

---

## 6. P2.5 — Android Gradle signing (after Google Play approval)

Gradle signing config + keystore generation script is **already wired**. You just need to:
1. Run the keystore script (one command, prompts for password)
2. Drop `google-services.json` from Firebase into `android/app/`
3. Build the AAB

### Step 6.1 — Generate keystore (interactive)

```sh
cd apps/web
./scripts/android-setup-keystore.sh
```

The script:
- Creates `android/app/tenantiq-release.keystore` (RSA 2048, 10000-day validity)
- Prompts twice for keystore + key password
- Writes `android/app/keystore.properties` (passwords) — gitignored
- Sets file permissions to 0600

**SAVE THE PASSWORD IN YOUR PASSWORD MANAGER.** If you lose the keystore + password, you can never update the app on Play Store. Backup the `.keystore` file too.

### Step 6.2 — Drop google-services.json from Firebase

```sh
cp ~/Downloads/google-services.json apps/web/android/app/google-services.json
```

That's it. The `apply plugin: 'com.google.gms.google-services'` directive is already conditionally wired in `android/app/build.gradle:47-54` — Capacitor scaffolds it. The classpath `com.google.gms:google-services:4.4.4` is already in `android/build.gradle`.

### Step 6.3 — Build release AAB

```sh
cd apps/web
npm run build:mobile             # rebuild web bundle for static target
npx cap sync android             # copy assets into Android project
cd android
./gradlew bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab
```

If signing fails with "no matching keystore", the `keystore.properties` file is missing. Re-run §6.1.

### Step 6.5 — SHA-1 fingerprint to Firebase

```sh
keytool -list -v -keystore app/tenantiq-release.keystore \
  -alias tenantiq | grep SHA1
```

Copy the SHA-1 → paste into Firebase Console → Project Settings → Android app → Add fingerprint.

---

## 7. P2.6 — Store submission (after P2.4 + P2.5)

### iOS (App Store Connect)

1. https://appstoreconnect.apple.com → My Apps → "+" → New App
2. Bundle ID: `app.tenantiq.app` (must match)
3. SKU: `tenantiq-ios-001` (any string, internal)
4. Fill app info: privacy policy URL, support URL, category (Business)
5. Screenshots required:
   - 6.7" iPhone (iPhone 15 Pro Max): 1290x2796 — 3 minimum
   - 6.5" iPhone: 1284x2778 or 1242x2688 — 3 minimum
   - 12.9" iPad Pro: 2048x2732 — 3 minimum (only required if you support iPad)
   - App icon: 1024x1024, no transparency, no rounded corners (Apple rounds them)
6. Upload `.ipa`:
   - Xcode → Product → Archive → Window → Organizer → Distribute App → App Store Connect
   - Or use Transporter app (App Store on Mac → search Transporter)
7. App Review questionnaire — TenantIQ uses Microsoft 365 OAuth, mention "Sign in with Microsoft" + that Sign in with Apple is offered (Apple requires it if you offer ANY social sign-in)
8. Submit for Review — typical review: 1-3 days

### Android (Play Console)

1. Play Console → All apps → TenantIQ → Production → Create new release
2. Upload `app-release.aab` from step 6.4
3. Release name: "1.0.0 - Initial release"
4. Release notes (multi-language supported)
5. Screenshots required:
   - Phone: 1080x1920 (or 1080x2400) — 2 minimum, 8 max
   - 7" tablet: 1024x600 — optional
   - 10" tablet: 1080x1920 — optional
   - Feature graphic: 1024x500 (required, shows on Play Store listing)
   - App icon: 512x512
6. Content rating questionnaire
7. Privacy policy URL (required)
8. Data safety form (declare what data you collect — for TenantIQ: M365 metadata, no personal user content)
9. Submit for Review — typical review: 1-7 days for first release

### Generating screenshots

Easiest path — use Playwright on your dev machine:

```sh
cd apps/web
npm run dev   # runs on http://localhost:5173

# In another terminal:
npx playwright codegen --viewport-size=1290,2796 http://localhost:5173
```

Sign in, navigate to dashboard / alerts / CIS / chat, take screenshots via the codegen UI. Repeat for each viewport size. Save to `apps/web/static/brand/screenshots/`.

Or use a service like https://www.appstorescreenshot.com to auto-generate marketing-style screenshots from raw screen captures.

---

## 8. Test passkey (WebAuthn) flow end-to-end

After VAPID is configured (or even before — passkey doesn't depend on push):

### Test 8.1 — Register a passkey

1. Open https://app.tenantiq.app on a device with biometrics (Mac with TouchID, iPhone, Android)
2. Sign in normally (Microsoft OAuth)
3. Navigate to Settings
4. Scroll to "Biometric login (passkey)" section
5. Type a device name (e.g. "MacBook TouchID")
6. Click "Add passkey"
7. System biometric prompt appears → use TouchID/FaceID/Windows Hello
8. Toast: "Passkey registered — biometric login enabled"

### Test 8.2 — Sign in with passkey

1. Sign out (clear cookies or use incognito)
2. Open https://app.tenantiq.app
3. Landing page — green "Sign in with passkey" button at top of card
4. Click it
5. System biometric prompt appears
6. Authenticate
7. Toast: "Signed in with passkey" → redirected to dashboard

### Test 8.3 — Verify session works

1. After passkey login, refresh — should stay signed in (cookie set)
2. Make any API call (e.g. view alerts) — should work
3. The session shows `webauthn: true` in the JWT (visible in TF logs at opensyber.cloud)

### Troubleshooting

- "This device does not support WebAuthn" — browser/OS too old, or platform authenticator disabled. Test on a different device.
- "Could not start passkey registration" — check API logs. Likely `webauthn_credentials` table missing (apply migration `0011_webauthn_credentials.sql`).
- "Passkey verification failed" — check `expectedRPID` in `apps/api/src/lib/webauthn-config.ts`. Production must be `tenantiq.app`. Local dev `localhost`.
- Passkey button missing on landing page — `isWebAuthnSupported()` returned false. WebAuthn requires HTTPS (or localhost). Check browser console.

---

## 9. Where logs live (operational reference)

| What | Where | Login required |
|---|---|---|
| TokenForge audit (every device verify) | OpenSyber dashboard at the URL in your `TOKENFORGE_API_KEY` welcome email | OpenSyber account |
| TokenForge errors only | `npx wrangler tail` from `apps/api/` | Cloudflare login |
| Web Push delivery results | Worker logs | Cloudflare |
| WebAuthn challenges (5min TTL) | KV under `wa-chal:*` keys | Cloudflare |
| Push subscriptions per user | KV under `push:{userId}:*` keys | Cloudflare |
| Push preferences per user | KV under `push-prefs:{userId}` | Cloudflare |
| Cron job results (security scan, alert generation) | Worker logs | Cloudflare |
| App Store crash reports | App Store Connect → Analytics → Diagnostics | Apple |
| Google Play crash reports | Play Console → Quality → Android Vitals | Google |
| Firebase Crashlytics (if enabled) | Firebase Console → Crashlytics | Google |

Worker tail filters:
```sh
cd apps/api

# All push activity
npx wrangler tail | grep -i 'push\|webauthn\|tokenforge'

# Just errors
npx wrangler tail | grep -i 'error'

# Specific tenant
npx wrangler tail | grep '<tenant-id>'
```

---

## 10. Order of operations (priority)

1. **Today:** Generate VAPID keys (step 1) — daily reminder routine pings until done
2. **This week:** Apple Developer enrollment (step 2) — multi-day wait, start ASAP
3. **This week:** Google Play Console enrollment (step 3) — also multi-day wait
4. **This week:** Firebase project (step 4) — quick, do it now
5. **When VAPID configured:** Test passkey flow (step 8) end-to-end
6. **When Apple approves:** Send me Team ID + Bundle ID + .p8 key → I'll wire P2.4
7. **When Google approves:** Send me google-services.json → I'll wire P2.5
8. **After P2.4 + P2.5:** Generate screenshots → submit to both stores (P2.6)

---

## 11. What NOT to do

- ❌ Don't commit `tenantiq-release.keystore` to git (gitignore it). If lost, you can never update the Android app.
- ❌ Don't commit `keystore.properties` (passwords inside).
- ❌ Don't commit `.p8` APNs key.
- ❌ Don't put VAPID `_PRIVATE_KEY` in `wrangler.toml` `[vars]` — use `wrangler secret put`. Vars are public; secrets are encrypted.
- ❌ Don't remove `app/src/main/assets/public/` from `android/.gitignore` — it's regenerated by `cap sync`.
- ❌ Don't enable "Capacitor live reload" in production — it loads JS from your dev server, security risk.
- ❌ Don't approve a passkey on a shared device unless the OS account is yours.

---

## 12. Cost summary (one-time + recurring)

| Item | Cost | Frequency |
|---|---|---|
| Apple Developer Program | $99 | Annual |
| Google Play Console | $25 | One-time |
| Firebase Cloud Messaging | $0 | Free tier covers any reasonable scale |
| D-U-N-S Number | $0 | One-time, takes 24-48hr |
| Web Push (VAPID) | $0 | Self-hosted on existing CF Workers |
| Capacitor | $0 | Open source |
| WebAuthn / passkeys | $0 | Built into browsers + OS |
| @simplewebauthn library | $0 | MIT |
| @pushforge/builder | $0 | MIT |

**Total recurring:** $99/year (Apple). Everything else is one-time or free.

---

## 13. Reference: deployed routine IDs

| Routine | When | Auto-detects |
|---|---|---|
| `trig_01CR5sAYLsbhP7M7c3fWFVeN` | once 2026-05-02 18:00Z | TF route-move 1-week post-deploy |
| `trig_01Jddoi7k49f69Khma6oa1JJ` | once 2026-05-02 19:00Z | Mobile P1 wrap-up + accounts check |
| `trig_01FF5KPW9oL7LrNvMn2fTyWq` | daily 06:00Z | VAPID configured? (self-disables when yes) |

Manage at https://claude.ai/code/routines.

---

*Last updated: 2026-04-25. API version baseline `0d4ef8aa-cb74-42ff-88af-fae12f442504`.*
