# Vendor Risk Register

Status date: 2026-05-26

This is the SOC 2 CC9.2 evidence package for critical vendor risk
management. The machine-readable source is
`docs/compliance/vendor-risk-register.json`; this page explains the review
standard used during auditor walkthroughs.

## Review Standard

Every critical or high vendor entry must include:

- owner
- review status
- services in use
- data access description
- vendor risk statement
- mitigations
- evidence paths
- next quarterly review date

The validation script fails if the required vendors are missing or if any
entry lacks the fields above.

## Required Vendors

| Vendor | Why Required |
|---|---|
| Cloudflare | Hosts Workers, R2, D1, KV, WAF, and DNS for hosted surfaces. |
| LemonSqueezy | Handles checkout/subscription webhook events for billing flows. |
| OFAC public sanctions source | Supplies public sanctions data for Starter-tier AML screening. |

GitHub is also tracked as a high-criticality development-platform vendor
because source control and CI are part of CC8 change-management evidence.

## Validation

Run:

```bash
node tools/validate-vendor-risk.mjs
```

The script validates the JSON schema, required critical vendors, evidence
paths, and quarterly review dates.
