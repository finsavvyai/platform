# Product Hunt Launch Brief

## Product Name
TokenForge

## Tagline (60 chars max)
Device-bound sessions that make stolen cookies useless

## Description (260 chars max)
Add one script tag. ECDSA keys auto-generated in the browser, every request signed. Stolen cookies die in 5 minutes. W3C DBSC-aligned. Free for 1K MAU. Workforce mode undercuts Cisco Duo at $4/user.

## Topics
- Developer Tools
- Security
- API
- SaaS
- Authentication

## Makers
@shachar

## Thumbnail concept
Split screen: left side shows a cookie being stolen (red, broken lock), right side shows the same cookie being rejected because the device key is missing (green, shield + key icon). TokenForge logo centered.

## First comment (from maker)
Hey Product Hunt! I built TokenForge because I was tired of seeing "MFA protects you" when it clearly doesn't protect sessions after login.

The problem: Evilginx-style AitM phishing steals your session cookie *after* MFA succeeds. Your MFA is fine. Your session isn't.

The fix: Bind the session to a cryptographic key that physically cannot leave the browser. No key = no session refresh = stolen cookie expires in 5 minutes.

Integration is one script tag or an npm package with adapters for every major framework. There's a free tier (1K MAU) so you can try it without a credit card.

For enterprise teams: Workforce Mode connects to your Okta/Entra/Google Workspace via OIDC, adds a policy engine for geo-blocking and step-up rules, and costs $4-7/user vs Cisco Duo's $9.

We follow the W3C DBSC spec so when browsers ship native TPM-backed device binding, you get hardware security for free with zero code changes.

Would love your feedback on the DX and what features matter most for your use case.

## Media
- Hero screenshot: Landing page with code snippet
- Dashboard screenshot: Sessions tab with trust scores
- Workforce screenshot: Policy editor with JSON DSL
- Architecture diagram: Browser SDK -> API -> D1

## Pricing to highlight
- Free: 1 app, 1K MAU
- Pro: $49/mo, 5 apps, 25K MAU
- Workforce: $4-7/user/mo (undercuts Duo)
