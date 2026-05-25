# LunaOS -- App Store Submission Guide

## 1. App Information

| Field              | Value                                |
|--------------------|--------------------------------------|
| App Name           | LunaOS                               |
| Subtitle           | AI Agents for Developers             |
| Bundle ID          | ai.lunaos.mobile                     |
| SKU                | lunaos-mobile-001                    |
| Primary Category   | Developer Tools                      |
| Secondary Category | Productivity                         |
| Privacy Policy URL | https://lunaos.ai/privacy            |
| Support URL        | https://docs.lunaos.ai               |
| Marketing URL      | https://lunaos.ai                    |
| Version            | 1.0.0                                |
| Build Number       | 1                                    |
| Copyright          | 2026 LunaOS Ltd.                     |

---

## 2. App Store Description

```
Build, deploy, and run AI agents from your pocket.

LunaOS puts the power of an AI agent platform in your hands. Browse a
marketplace of ready-made agents, execute complex workflows with a
single tap, and monitor results in real time -- all from your iPhone
or iPad.

KEY FEATURES

- Agent Marketplace: Discover and install AI agents across coding,
  data analysis, DevOps, writing, and more.
- One-Tap Execution: Run agents instantly with configurable
  parameters and live streaming output.
- Execution History: Review past runs, outputs, and logs with full
  traceability.
- Real-Time Streaming: Watch agent responses arrive via SSE as they
  process your requests.
- Dark Mode: Beautiful interface that adapts to your system
  appearance, following Apple HIG.
- Secure by Default: JWT authentication with Keychain storage.
  All traffic encrypted via HTTPS.

FREE TIER
- Access to 10 community agents
- 50 executions per month
- Execution history (7-day retention)

PRO TIER ($9.99/month)
- Unlimited agent access
- Unlimited executions
- 90-day history retention
- Priority execution queue
- Custom agent creation via LunaOS Studio

LunaOS connects to the same platform trusted by thousands of
developers at api.lunaos.ai. Your agents, workflows, and history
sync seamlessly across mobile, web dashboard, CLI, and Studio IDE.

Built with privacy in mind. We never train on your data.
```

---

## 3. Keywords

```
ai,agents,developer,tools,automation,workflow,devops,coding,llm,mcp
```

## 4. What's New (v1.0.0)

```
Welcome to LunaOS for iOS!

- Browse and search the AI agent marketplace
- Execute agents with real-time streaming output
- View full execution history with logs
- Secure login with JWT and Keychain storage
- Light and dark mode support
- iPad support with adaptive layouts
```

---

## 5. Screenshot Requirements

### 6.7-inch (iPhone 15 Pro Max) -- Required

| Screenshot | Content                                              |
|------------|------------------------------------------------------|
| 1          | Agent marketplace grid with category filters visible |
| 2          | Agent detail card with "Run" button prominent        |
| 3          | Execution screen with live streaming output          |
| 4          | History list showing completed runs with status      |
| 5          | Settings screen showing account and theme toggle     |

### 6.5-inch (iPhone 14 Plus) -- Required

Same content as 6.7-inch, re-captured at 1284x2778 resolution.

### 5.5-inch (iPhone 8 Plus) -- Required if supporting older devices

Same content as above, re-captured at 1242x2208 resolution.

### iPad Pro 12.9-inch (6th gen) -- Required (supportsTablet: true)

Same content, captured at 2048x2732 showing adaptive tablet layout.

Use Fastlane `snapshot` or Expo `expo-screen-capture` for automation.

## 6. App Review Notes

```
Demo Account:
  Email: reviewer@lunaos.ai
  Password: AppReview2026!

The app requires an internet connection to function. It connects to
our API at https://api.lunaos.ai.

To test core functionality:
1. Log in with the demo credentials above.
2. Navigate to the Agents tab and browse available agents.
3. Tap any agent, configure parameters, and press "Run".
4. Observe real-time streaming output on the execution screen.
5. Navigate to History to see completed executions.
6. Open Settings to toggle dark mode and view account info.

No special hardware or configuration is required. The app does not
use any private or undocumented APIs.
```

---

## 7. EAS Build & Submit Commands

```bash
# Install EAS CLI (if not installed)
npm install -g eas-cli

# Log in to Expo account
eas login

# Build production iOS binary
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios

# Combined build + submit
eas build --platform ios --profile production --auto-submit
```

---

## 8. Pre-Submission Checklist

**Apple Developer Account**
- [ ] Active Apple Developer Program membership ($99/year)
- [ ] App ID registered: ai.lunaos.mobile
- [ ] Team ID configured in eas.json

**Certificates & Provisioning**
- [ ] iOS Distribution Certificate created
- [ ] App Store provisioning profile generated
- [ ] Push notification entitlement (if applicable)
- [ ] EAS credentials configured: `eas credentials`

**App Store Connect Setup**
- [ ] App record created in App Store Connect
- [ ] App Information filled (name, subtitle, category)
- [ ] Pricing: Free with In-App Purchase (Pro tier)
- [ ] Screenshots uploaded for all required device sizes
- [ ] Description, keywords, and support URL filled
- [ ] Privacy policy URL verified and accessible

**Privacy Declarations**
- [ ] Contact Info: email (registration). Identifiers: user ID
- [ ] Usage Data: product interaction. Diagnostics: crash/perf data
- [ ] Declare: data NOT used for tracking, linked to user identity

**Age Rating & Export Compliance**
- [ ] Age rating questionnaire completed (expected: 4+)
- [ ] No user-generated content without moderation
- [ ] HTTPS only (ATS compliant), no custom encryption
- [ ] "Uses Non-Exempt Encryption" set to NO

**Final Validation**
- [ ] `expo doctor` passes with no errors
- [ ] `eas build` completes successfully
- [ ] TestFlight build installed on physical iPhone and iPad
- [ ] Dark mode tested on all screens
- [ ] Accessibility: VoiceOver navigation verified
- [ ] Deep links tested (lunaos:// scheme)
