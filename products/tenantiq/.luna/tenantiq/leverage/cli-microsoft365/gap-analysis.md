<!-- cspell:words tenantiq pnp climicrosoft365 -->

# Gap Analysis — CLI for Microsoft 365 vs tenantiq

## What CLI for Microsoft 365 has that tenantiq doesn't

| CLI for M365 feature (README) | tenantiq state | Gap |
|---|---|---|
| **Federated identity** auth method | tenantiq auth uses Microsoft OAuth + WebAuthn passkeys (`SignInHero.svelte`, `auth-webauthn-*.ts`). No federated/SAML. | **open** — exactly the SSO milestone in CLAUDE.md "Left → Priorities §1" |
| **Azure Managed Identity** auth | Not in tenantiq codebase (Workers do not support managed identity natively but pattern is portable for hosted-mode tenants) | open (low priority) |
| **Certificate** auth for Graph | tenantiq uses delegated/admin-consent flows only | open |
| **Workload coverage**: Bookings, Planner, Power Apps/Automate, To Do, Viva, OneNote | tenantiq sidebar has none of these surfaces | open (out of charter for now) |
| TypeScript implementation, MIT license | Tenantiq is also TS — direct port is feasible | green-light |
| **`m365 setup` command** for bootstrapping a custom Entra app registration | tenantiq onboarding is web-based via `apps/web/src/lib/components/onboarding/OnboardingWizard.svelte` (CLAUDE.md page map) | covered (different shape) |

## What tenantiq has that CLI for M365 doesn't

- Web SaaS, multi-tenant, MSP-oriented UI.
- AI analysis layer.
- Compliance + scoring (CIS scanner).
- Background queues, alerts, real-time dashboards.

## Verdict

CLI for Microsoft 365 is the **TypeScript Graph-client + auth-method library** reference. Direct dependency adoption is risky on Cloudflare Workers (Node-only assumptions); selective code lift of auth helpers + per-workload Graph wrappers is the high-leverage path.

Single biggest takeaway: **the federated-identity pattern** unlocks the SSO milestone faster than building from scratch.
