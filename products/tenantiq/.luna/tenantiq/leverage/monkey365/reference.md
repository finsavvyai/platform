<!-- cspell:words tenantiq monkey365 silverhack invokes Entra Purview sharepoint -->

# Monkey365

- URL: https://github.com/silverhack/monkey365
- Stars: **1 271** (gh api, fetched 2026-04-27)
- Forks: 139
- License: Apache-2.0
- Language: PowerShell
- Default branch: main
- Last push: 2026-04-15
- Topics: azure-security-audit, azuread-scanner, cis-benchmark, entraid-assessments, microsoft365-scanner, microsoft365-security, purview, security-tools, sharepoint-online (full list in API)
- README source: `monkey365/README.raw.md` (8 021 bytes)

## What it does

Per README §intro: "Open Source security tool … to easily conduct not only Microsoft 365, but also Azure subscriptions and Microsoft Entra ID security configuration reviews … Provides valuable recommendations on how to best configure those settings."

## Capabilities (cited)

- "160+ checks covering industry defined security best practices for Microsoft 365, Azure and Entra ID" (README "Regulatory compliance checks")
- Multi-cloud: Azure, Microsoft Entra ID, M365 core apps
- Output formats: CSV, JSON, HTML (README example)
- National-cloud aware: AzurePublic / AzureChina / AzureUSGovernment (README "Running … in National or Gov Cloud Environments")

## Supported standards (README "Supported standards")

- CIS Microsoft Azure Foundations Benchmark v3.0.0
- CIS Microsoft Azure Database Services Benchmark v2.0.0
- CIS Microsoft 365 Foundations Benchmark v3.0.0, v4.0.0, v5.0.0
- "More standards will be added in next releases (NIST, HIPAA, GDPR, PCI-DSS, etc.)"

## Run model (README "Basic Usage")

```powershell
$options = @{
    Instance = 'Microsoft365';
    Collect = 'ExchangeOnline';
    PromptBehavior = 'SelectAccount';
    IncludeEntraID = $true;
    ExportTo = 'CSV';
}
Invoke-Monkey365 @options
```

## Relevance to tenantiq

- Direct competitor on M365 + Entra ID security review.
- Multi-standard pattern (CIS v3/v4/v5 + future NIST/HIPAA/PCI) maps onto tenantiq's "5 frameworks" claim and `/security/purview` + `/audit` pages.
- Apache-2.0 license — compatible for derivative use with NOTICE.

## Not stated in README

- Exact list of the 160+ checks (need source clone to enumerate).
- Whether checks include remediation suggestions vs. report-only (README implies recommendations but doesn't specify auto-fix).
