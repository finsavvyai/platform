# Competitive — Prioritized Next Actions

> Distilled from three research docs. Sequenced by impact × effort. Each bullet a concrete sprint item.

---

## P0 — ship this quarter (high impact, low effort)

### Product

- [ ] **Runtime attestation feed in dashboard** — surface the osquery + seccomp telemetry you already collect as a live stream on a dedicated page. Differentiator: no competitor hosting agent + showing security events in one UI.
- [ ] **Sigstore signing + SBOM on every marketplace skill** — 4 hours of cosign wiring. Kills Lasso MCP Gateway's "we audit MCP servers" angle because we audit *and* sign the skills.
- [ ] **MIT-license TokenForge client + server packages**, already published to npm. Commit license change + update README with install instructions. Zero new code.
- [ ] **Publish `@opensyber/claw-sdk` to npm** ← done this session
- [ ] **Comparison page on marketing site** — 3 tables: vs Modal, vs Lasso, vs Protect AI. Pure content, no code.

### Positioning

- [ ] Rewrite homepage hero to lead with **three pillars**: "Runtime + security + marketplace, one surface"
- [ ] Add "Verified Publisher" badge on sign-in page once MPN lands (see `../mpn-partner-program.md`)

## P1 — ship next quarter (high impact, moderate effort)

### Product

- [ ] **Modal adapter SDK** (`@opensyber/modal-adapter`) — wrap `modal.sandbox.Sandbox` calls with OpenSyber security layer. Sidecar GTM play. Let Modal users keep Modal compute, add our runtime attestation.
- [ ] **Fly.io adapter SDK** (`@opensyber/fly-adapter`) — same pattern for Fly Sprites.
- [ ] **TokenForge MCP adapter** as first-class published package — differentiation: nobody in the auth space ships MCP integration.
- [ ] **Free-tier uplift**: raise daily runs from 10 → 50 to close gap with Modal $30 credits. A/B first.

### Pricing

- [ ] Announce **TokenForge free <10K MAU forever** commitment. Public page at `tokenforge.opensyber.cloud/pricing`.
- [ ] Per-bound-device pricing tier for TokenForge enterprise (pricing lever nobody else has).

## P2 — strategic bets (high impact, high effort)

- [ ] **OpenAgentSec open spec** — submit to Linux Foundation Agentic AI Foundation. Runtime attestation + signed skills + device-bound auth primitives. Commoditize security layer, become the reference implementation. Monetize compliance + marketplace + managed hosting on top.
- [ ] **Open-source OpenSyber agent runtime**. Keep marketplace + compliance + hosted control plane closed. Aligns with OpenAgentSec spec bet.
- [ ] **Acquire small AI-security OSS project** (garak, rebuff, llm-guard) — bootstrap developer presence + SEO.
- [ ] **Free lifetime Pro tier for 100 YC founders** — reference customer logos before PANW/Check Point/F5 bundles catch them.

---

## Threat-driven mitigations

### Against Modal × OpenAI Agents SDK (April 2026)

- Publish Modal adapter (P1)
- Blog: "Why we chose per-user Hetzner VMs over Firecracker microVMs" — control narrative on isolation model
- Support matrix page showing OpenSyber + Modal as complementary not competing

### Against Lasso OSS MCP Gateway

- Ship Sigstore signing + SBOM (P0) so our marketplace skills have a verifiable trust chain Lasso can't match
- First-class Claude Code / Cursor / Windsurf tabs already shipped — deepen with MCP-specific security telemetry

### Against Clerk (TokenForge flank)

- Lead TokenForge marketing with **"non-extractable ECDSA Web Crypto — Clerk can't give you this"**
- Keep DX within 1 docs click of Clerk's onboarding speed. Build a Next.js 16 middleware tutorial for TokenForge.
- MIT-license client + server (P0) — Clerk is proprietary, so open source is the structural wedge.

### Against Protect AI → Palo Alto consolidation

- Lean into PLG messaging: "self-serve, 60-second deploy, no demo required". PANW's model will never match.
- Target developers not CISOs. Bottom-up adoption before enterprise bundles catch up.

### Against Replit prod-DB incident narrative

- Publish "Agents can't destroy your DB — here's how our seccomp profile enforces write-deny on prod paths" blog.
- Offer explicit "no-delete mode" skill flag in marketplace schema.

---

## What this session already shipped

- [x] `@opensyber/cli@0.1.1` on npm
- [x] `@opensyber/tokenforge@0.1.1` on npm — **Non-extractable ECDSA device-binding SDK now publicly installable (per P0 above)**
- [x] `@opensyber/mcp@0.1.0` on npm
- [x] `@opensyber/skill-sdk@0.1.0` on npm
- [x] Playwright OAuth smoke tests for all 4 providers (Google, GitHub, Microsoft, LinkedIn)
- [x] Dashboard empty-state crash fixes for new users (affects every provider)
- [x] Per-user scoped localStorage (ends cross-user org-id leak)
- [x] Gateway token retrieval via DB decrypt (unblocks Reveal/Copy for new users after hashed-KV migration)
- [x] Six IDE tabs on ConnectAgentCard (CLI, MCP, VS Code, Cursor, Windsurf, Claude Code)

## What this session set up but needs user to finish

- [ ] Microsoft Entra OpenSyber app — config done, real-account smoke test pending
- [ ] TokenForge Entra app — code migration ready in git; portal steps in `../tokenforge-entra-setup.md`
- [ ] Microsoft Partner Program MPN — guide at `../mpn-partner-program.md` (unlock Verified Publisher badge)
