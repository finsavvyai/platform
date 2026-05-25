<!-- cspell:words tenantiq Microsoft365DSC powershell exo intune codecov tenantiq -->

# Microsoft365DSC

- URL: https://github.com/Microsoft365DSC/Microsoft365DSC (full_name from API; redirected from `microsoft/Microsoft365DSC`)
- Stars: **2 266** (gh api, fetched 2026-04-27)
- Forks: 650
- License: MIT
- Language: PowerShell
- Default branch: Dev
- Last push: 2026-04-24
- Topics: azuread, configuration-as-code, desiredstateconfiguration, devops, exchangeonline, intune, microsoft365, monitoring, office365, sharepoint, teams (full list in API)
- README source: `Microsoft365DSC/README.raw.md` (5 047 bytes)

## What it does

Per README §1: "automate the deployment, configuration, reporting and monitoring of Microsoft 365 Tenants via PowerShell Desired State Configuration."

Uses DSC LCM (Local Configuration Manager) to push state to a remote M365 tenant.

## Capabilities (README + topics)

- Automated **deployment** of tenant config
- **Configuration extraction** from a tenant (config-as-code reverse engineering)
- **Drift detection** + reporting
- **Monitoring** (continuous compliance check)
- Workloads: Exchange Online, SharePoint, Teams, OneDrive, Intune, Power Platform, Security & Compliance, Entra ID

## Operational model (README)

- `Install-Module -Name Microsoft365DSC -Force`
- `Update-M365DSCModule`
- Telemetry on by default; opt-out via `Set-M365DSCTelemetryOption -Enabled $False`

## Relevance to tenantiq

- tenantiq has **Config Snapshot & Drift Detection** in the "Left → Priorities" list (CLAUDE.md `What's Done vs What's Left` §3). Microsoft365DSC is the reference implementation.
- Their **resource-per-workload** schema is a portable mental model for tenantiq's `config_snapshots` table (per CLAUDE.md schema-d1 references).
- MIT license — derivative works permitted with attribution.

## Not stated in README

- No explicit count of supported resources (need to clone repo to enumerate; not done).
- README has minimal feature detail; bulk of docs lives at `Microsoft365DSC.com` (external site, not fetched).
