<!-- cspell:words tenantiq pnp climicrosoft365 sharepoint planner powerapps spfx -->

# CLI for Microsoft 365 (pnp/cli-microsoft365)

- URL: https://github.com/pnp/cli-microsoft365
- Stars: **1 288** (gh api, fetched 2026-04-27)
- Forks: 386
- License: MIT
- Language: TypeScript
- Default branch: main
- Last push: 2026-04-24
- Topics: azure-active-directory, cli, entra-id, microsoft-graph, microsoft-365, sharepoint-online, spfx (full list in API)
- README source: `cli-microsoft365/README.raw.md` (7 741 bytes)

## What it does

Per README §intro: "CLI for Microsoft 365 helps you manage your Microsoft 365 tenant and SharePoint Framework projects."

## Workloads supported (README "Features → Supported workloads")

Bookings, Microsoft Entra ID, Microsoft Teams, Microsoft To Do, Microsoft Viva, OneDrive, OneNote, Outlook, Planner, Power Automate, Power Apps, Power Platform, Purview, SharePoint Embedded, SharePoint Online, SharePoint Premium, To Do.

## Authentication (README "Supported authentication methods")

- Azure Managed Identity
- Certificate
- Client Secret
- Device Code
- Federated identity
- Username and Password

## Distribution (README "Install")

- npm: `@pnp/cli-microsoft365`
- yarn, npx, Docker (`m365pnp/cli-microsoft365:latest`)
- Node.js 20+

## Relevance to tenantiq

- **Highest TypeScript-fit** of the 5 candidates — tenantiq API is TS Hono on Workers. Direct module imports possible (pending bundle-size check + Workers-runtime compatibility).
- Auth-method coverage broader than tenantiq's current Microsoft OAuth + WebAuthn. Federated + Managed Identity patterns portable for enterprise SSO milestone (CLAUDE.md "Left → Priorities §1").
- MIT license.

## Not stated in README

- Whether the package is tree-shakeable for selective import on Workers runtime.
- Bundle size (README does not state).
- Whether it works on Cloudflare Workers (almost certainly tested only on Node.js, will need verification).
