# Microsoft Graph Permissions — Justification

> Required for M365 Cert (control E1) and Publisher Verification.
> Auditor will challenge any scope that isn't tied to a delivered feature.

Last updated: 2026-04-29. Source of truth: `apps/api/src/lib/constants.ts` `GRAPH.OAUTH_SCOPES`.

## Principle

Each scope must map to a **shipped, customer-visible** capability. If a scope isn't producing UI/value, **remove it before submission** — over-scoping is the #1 reason apps fail Cert L1.

## Delegated scopes inventory

| Scope | Used by | Feature | Justification | Drop? |
|---|---|---|---|---|
| `openid`, `profile`, `email`, `offline_access` | auth | sign-in + token refresh | required by spec | keep |
| `User.Read` | dashboard | display signed-in user | minimal | keep |
| `User.Read.All` | tenants/users sync | user inventory, lifecycle workflows | core feature | keep |
| `User.ReadWrite.All` | lifecycle remediations | disable account, reset password | remediation feature | keep — gate by paid plan |
| `Group.Read.All` | dashboard, sync | group membership audit | core | keep |
| `Group.ReadWrite.All` | governance workspaces | group lifecycle remediation | feature | keep — gate |
| `Directory.Read.All` | tenant overview | directory metadata | core | keep |
| `Organization.Read.All` | tenant overview | tenant metadata, branding | core | keep |
| `SecurityEvents.Read.All` | alerts feed | M365 Defender alerts | core | keep |
| `AuditLog.Read.All` | sign-in logs page | sign-in / audit visibility | core | keep |
| `Policy.Read.All` | CIS scanner | conditional access, auth policies eval | core | keep |
| `Policy.ReadWrite.ConditionalAccess` | CIS auto-remediate | toggle CA policies | remediation | keep — gate |
| `IdentityRiskEvent.Read.All` | alerts, behavior | risky sign-ins | core | keep |
| `IdentityRiskyUser.Read.All` | alerts, behavior | risky users feed | core | keep |
| `UserAuthenticationMethod.Read.All` | MFA audit | per-user MFA inventory | core | keep |
| `UserAuthenticationMethod.ReadWrite.All` | remediation | enroll/reset auth methods | remediation | **review** — drop unless used |
| `RoleManagement.Read.All` | governance | privileged role audit | core | keep |
| `Reports.Read.All` | usage, copilot readiness | activity reports | core | keep |
| `Application.Read.All` | app inventory | OAuth app risk | core | keep |
| `Sites.Read.All` | storage, sharing | SharePoint/OneDrive scan | core | keep |
| `MailboxSettings.Read` | email security | mailbox config audit | core | keep |
| `InformationProtectionPolicy.Read` | sensitivity labels | label inventory | core | keep |
| `CrossTenantInformation.ReadBasic.All` | tenant detection | external tenant risk | core | keep |
| `DelegatedPermissionGrant.Read.All` | app inventory | OAuth grants audit | core | keep |
| `DeviceManagementConfiguration.Read.All` | (planned) Intune | NOT YET WIRED — see `docs/MS_CERTIFICATION.md` E5 | **drop until shipped** |

## Not requested (explicit exclusions)

- `Mail.Read` / `Mail.ReadWrite` — we don't read message content
- `Files.Read.All` — we don't read file content; only metadata via `Sites.Read.All`
- `Calendars.Read` — out of scope
- `Chat.Read.All` — out of scope
- `InformationProtectionPolicy.ReadWrite.All` — **does not exist as delegated**, removed after AADSTS650053 (constants.ts:100-102)

## Per-scope auditor narrative

For each "keep" scope, when filling Partner Center Justification field, use this template:

> **Scope**: `<scope>`
> **Feature**: `<feature name>`
> **UI surface**: `<route or component>`
> **Data accessed**: `<minimal field list>`
> **Storage**: `<D1 table or "not stored, computed on demand">`
> **Retention**: `<see DATA_RETENTION.md row>`
> **Why required**: `<one sentence>`
> **Alternative considered**: `<lower-priv scope or workaround>` — `<why insufficient>`

## Action items before submission

1. **Drop** `DeviceManagementConfiguration.Read.All` from `OAUTH_SCOPES` until Intune feature ships.
2. **Verify** `UserAuthenticationMethod.ReadWrite.All` actually has a write path — if not, drop to `.Read.All`.
3. **Justify** every "keep" scope in Partner Center using the template above.
4. **Re-test** sign-in after scope changes — incremental consent will re-prompt admin.
5. **Document** the gating: paid-plan-only remediation scopes appear in admin consent only when needed.

## Application-level scopes

This app uses **delegated only**. No application (app-only) scopes requested. If/when added (e.g. for cron-based unattended scans), each must be justified separately and additionally requires admin consent.
