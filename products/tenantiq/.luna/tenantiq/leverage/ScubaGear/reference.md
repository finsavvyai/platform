<!-- cspell:words tenantiq scubagear cisagov scubaconfigapp invokes scuba opa rego -->

# ScubaGear

- URL: https://github.com/cisagov/ScubaGear
- Stars: **2 546** (gh api repos/cisagov/ScubaGear, fetched 2026-04-27)
- Forks: 354
- License: CC0-1.0
- Language: PowerShell
- Default branch: main
- Last push: 2026-04-27
- Topics (from API): assessment-tool, cisa, cybersecurity, m365, open-policy-agent, powershell, rego, security, security-automation
- README source: `ScubaGear/README.raw.md` (12 286 bytes)

## What it does

CISA-published assessment tool that "verifies that a Microsoft 365 (M365) tenant's configuration conforms to the policies described in the Secure Cloud Business Applications (SCuBA) Secure Configuration Baseline documents." (README §intro)

## Architecture (cited)

Three steps (README "Overview"):

1. PowerShell queries M365 APIs for configuration settings.
2. Calls Open Policy Agent (OPA) to compare settings against Rego security policies written per the baseline documents.
3. Reports HTML, JSON, CSV.

## Baseline coverage (README "Baseline Security Coverage")

- Microsoft Entra ID
- Security Suite (advanced threat protection)
- Exchange Online
- Power BI
- Power Platform
- SharePoint
- Teams

SCuBA controls mapped to NIST SP 800-53 + MITRE ATT&CK (README states).

## Outputs (README "ScubaGear Output")

- HTML: interactive compliance report (sample link in README)
- JSON: structured results
- CSV: spreadsheet export

## Configuration UI (README "Scuba Configuration UI")

- `Start-ScubaConfigApp` PowerShell cmdlet
- Step-by-step wizard
- Real-time YAML preview + validation
- Microsoft Graph integration for user/group selection
- YAML import/export

## Run model (README "Quick Start")

- First run without config → generates baseline template
- Edit YAML → re-run with `-ConfigFilePath` to compare against intended state
- BOD 25-01 mode requires YAML config

## Relevance to tenantiq

- Direct competitor on **CIS Benchmark + Configuration evaluation** dimension. tenantiq has CIS scanner (`apps/api/src/lib/cis/scanner.ts`); ScubaGear has Rego-based policy engine.
- Output format ideas: HTML/JSON/CSV mirrors what tenantiq's `/reports` page should produce.
- YAML config-as-code idea: tenantiq currently has no per-tenant policy override file. ScubaGear's "exclusions / annotations / omissions" pattern is portable.

## Not stated in README (do not assume)

- License compatibility with embedding the OPA policies directly (CC0 is permissive, but NIST/MITRE mapping data ownership unverified).
- Number of controls evaluated (README says "baselines" but no exact count).
