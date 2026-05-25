# Legal-vertical DLP preset

The `legal_preset` is an opt-in pattern pack the SDLC gateway can
apply to inbound prompts and outbound responses for tenants in the
legal-AI vertical (mid-market law firms, in-house legal teams,
litigation boutiques). It surfaces textual markers of attorney-
client privilege, work-product doctrine, discovery protective
orders, NDAs, and U.S. litigation identifiers and routes them
through the same `tenant_dlp_policy` action enum already in use:
`allow | mask | redact | block | tokenize`.

> **This preset is a heuristic, not a privilege determination.**
> Detection of "Privileged & Confidential" does not establish
> privilege under [ABA Model Rule 1.6][rule-1.6]; absence does not
> waive it. The preset reduces obvious LLM-paste mistakes (an
> associate dropping a memo header into a public chat). It is not
> a substitute for outside-counsel review or an information-
> governance program. Treat it as defense-in-depth.

## Activation

The preset is gated by a per-tenant boolean
`tenant_dlp_policy.legal_preset` (migration lands separately). The
gateway loads it at request time and merges it with the built-in
PII pack (SSN, EIN, email, credit cards, etc.) and any tenant-
defined `custom_patterns` from the same row.

Default recommended action: **`mask`**. We deliberately do NOT
recommend `block` as the default because a false positive on a
benign phrase (e.g., "subject to revision") can wedge legitimate
intake and matter-management workflows. Mask preserves length and
records the detection in the audit trail without dropping content.
Firms with stricter posture can override to `redact`, `block`, or
`tokenize` per-tenant through the admin UI.

## Authoritative sources

- [ABA Model Rules of Professional Conduct (current edition)][aba-mrpc]
- [ABA Formal Opinion 512 — Generative AI Tools (2024)][aba-512]
- [Federal Rules of Civil Procedure, Rule 26 (work-product doctrine in 26(b)(3))][frcp-26]
- [Federal Rules of Evidence, Rule 502 (no-waiver orders)][fre-502]
- [California State Bar — Practical Guidance for the Use of Generative AI (Nov 2023)][ca-gai]
- [Florida Bar Ethics Opinion 24-1 (Jan 2024)][fl-24-1]
- [NY State Bar Task Force on AI — Report and Recommendations (Apr 2024)][nybar-ai]
- [Illinois State Bar Association Opinion 24-01 (Apr 2024)][isba-24-01]

[aba-mrpc]: https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/
[aba-512]: https://www.americanbar.org/groups/professional_responsibility/aba-formal-opinion-512/
[frcp-26]: https://www.law.cornell.edu/rules/frcp/rule_26
[fre-502]: https://www.law.cornell.edu/rules/fre/rule_502
[rule-1.6]: https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_6_confidentiality_of_information/
[rule-1.18]: https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_1_18_duties_of_to_prospective_client/
[rule-4.4]: https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_4_4_respect_for_rights_of_third_persons/
[rule-3.4]: https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_3_4_fairness_to_opposing_party_counsel/
[rule-5.5]: https://www.americanbar.org/groups/professional_responsibility/publications/model_rules_of_professional_conduct/rule_5_5_unauthorized_practice_of_law_multijurisdictional_practice_of_law/
[ca-gai]: https://www.calbar.ca.gov/Portals/0/documents/ethics/Generative-AI-Practical-Guidance.pdf
[fl-24-1]: https://www.floridabar.org/etopinions/opinion-24-1/
[nybar-ai]: https://nysba.org/app/uploads/2022/03/2024-April-Report-and-Recommendations-of-the-Task-Force-on-Artificial-Intelligence.pdf
[isba-24-01]: https://www.isba.org/sites/default/files/ethicsopinions/24-01.pdf

## Patterns

Each pattern is listed below with: detection class name (the
`name` field on the `pattern` struct, which becomes the redact
placeholder `<UPPER_NAME>`), the rule it protects, an example that
fires it, and an example that intentionally does NOT fire it (the
false-positive guard, verified in `dlp_legal_test.go`).

### Category 1 — Attorney-client privilege markers

Source: [`dlp_legal_privilege.go`](../../services/gateway/internal/infrastructure/middleware/dlp_legal_privilege.go)

| Class | Rule | Positive example | Negative (must NOT fire) |
|---|---|---|---|
| `attorney_client_privilege` | [ABA Model Rule 1.6][rule-1.6] | `PRIVILEGED & CONFIDENTIAL — Re: Acme matter` | `This account has privileged access to the database.` |
| `attorney_client_privilege` | [ABA Model Rule 1.6][rule-1.6] | `Subject to the Attorney-Client Privilege` | `Our client portal supports privileged escalation paths.` |
| `attorney_client_privilege` | [ABA Model Rule 1.6][rule-1.6] | `Attorney-Client Communication — do not share` | `The customer-service team handled the communication promptly.` |
| `do_not_forward` | [ABA Model Rule 4.4(b)][rule-4.4] | `Do Not Forward Outside Counsel` | `Please forward your timesheet to payroll by Friday.` |
| `inadvertent_disclosure_notice` | [ABA Model Rule 4.4(b)][rule-4.4] | `Pursuant to ER 4.4(b), please return this email` | `Pursuant to section 4.4 of the manual, please reboot.` |
| `prospective_client_communication` | [ABA Model Rule 1.18][rule-1.18] | `Prospective Client Communication — no engagement yet` | `Our prospective customer asked about pricing tiers.` |

### Category 2 — Work-product doctrine markers

Source: [`dlp_legal_privilege.go`](../../services/gateway/internal/infrastructure/middleware/dlp_legal_privilege.go)

Federal protection rooted in [FRCP 26(b)(3)][frcp-26] and *Hickman v.
Taylor*, 329 U.S. 495 (1947). Opinion work product (mental
impressions) receives near-absolute protection per FRCP 26(b)(3)(B).

| Class | Rule | Positive example | Negative |
|---|---|---|---|
| `attorney_work_product` | [FRCP 26(b)(3)][frcp-26] | `ATTORNEY WORK PRODUCT — Draft motion to dismiss` | `The product attorney reviewed the EULA last week.` |
| `work_product_anticipation` | [FRCP 26(b)(3)(A)][frcp-26] | `Prepared in Anticipation of Litigation` | `The schedule was prepared in anticipation of the next sprint.` |
| `trial_preparation_material` | [FRCP 26(b)(3)][frcp-26] | `Trial Preparation Materials — witness outlines attached` | `The trial of the new feature is scheduled for Friday.` |
| `attorney_mental_impressions` | [FRCP 26(b)(3)(B)][frcp-26] | `Attorney Mental Impressions on key witness` | `The candidate gave a strong mental impression in the interview.` |
| `litigation_strategy` | [FRCP 26(b)(3)(B)][frcp-26] | `Litigation Strategy Memo — Q3 case posture` | `The product strategy meeting covered Q3 launches.` |

### Category 3 — Litigation identifiers

Source: [`dlp_legal_identifiers.go`](../../services/gateway/internal/infrastructure/middleware/dlp_legal_identifiers.go)

Docket numbers, case captions, state-bar numbers, EIN. SSN is
already covered by the built-in pack in `dlp.go`. Attorney **names**
are deliberately omitted — that policy choice belongs to the firm,
not the gateway. Firms that want attorney-name redaction can add it
via `custom_patterns` JSONB.

| Class | Rule / source | Positive example | Negative |
|---|---|---|---|
| `federal_docket_number` | JCUS PACER conventions | `1:24-cv-01234-ABC` | `Build 1:24 deployed to staging last night.` |
| `state_docket_number` | State-court conventions | `CV-2024-001234` | `Customer reference R-2024 was archived.` |
| `case_caption` | [ABA Model Rule 1.6][rule-1.6] (client identity) | `In re Acme Industries, Inc.` | `In real life, our customers rely on the SLA.` |
| `case_caption` | [ABA Model Rule 1.6][rule-1.6] | `Smith v. Jones, 123 F.3d 456 (9th Cir. 2024)` | `We chose option A vs. option B for the launch.` |
| `ca_bar_number` | [ABA Model Rule 5.5][rule-5.5], [CA Bar member records][ca-mem] | `SBN 234567` | `The bar code on the package is 234567.` |
| `ny_bar_number` | NY Judiciary Law §468-a | `NY Att'y Reg. No. 1234567` | `Our internal reg. number system uses 6-digit codes.` |
| `tx_bar_number` | Tex. Gov't Code §81.114 | `Texas Bar No. 12345678` | `The Texas office handles 12345678 tickets per quarter.` |
| `fl_bar_number` | Rule 1-3.2, Rules Regulating The Florida Bar | `FL Bar No. 123456` | `Our Florida region had 123456 visits last month.` |
| `ein` | IRS Pub. 1635 | `EIN 12-3456789` | `Version 12-3456789a was released last Tuesday.` |

[ca-mem]: https://www.calbar.ca.gov/Attorneys/Member-Records

### Category 4 — Discovery / protective-order markers

Source: [`dlp_legal_discovery.go`](../../services/gateway/internal/infrastructure/middleware/dlp_legal_discovery.go)

Documents produced under [FRCP 26(c)][frcp-26] protective orders or
[FRE 502(d)][fre-502] no-waiver agreements. Bates stamps follow the
de-facto convention recorded by [The Sedona Conference][sedona].

[sedona]: https://thesedonaconference.org/publication/Sedona_Conference_Cooperation_Proclamation

| Class | Rule | Positive example | Negative |
|---|---|---|---|
| `discovery_confidential` | [FRCP 26(c)][frcp-26] | `Stipulated Confidential per PO §3` | `The agreement is mutually confidential between the parties.` |
| `highly_confidential_aeo` | [FRCP 26(c)][frcp-26] | `Highly Confidential — Attorneys' Eyes Only` | `This is highly confidential material under our NDA, no AEO designation.` |
| `highly_confidential_aeo` | [FRCP 26(c)][frcp-26] | `HC-AEO stamp on every page` | `Our HCM system handles HR onboarding.` |
| `protective_order_subject` | [FRCP 26(c)][frcp-26] | `Subject to the Protective Order entered 2024-03-12` | `This update is subject to the regular change-control process.` |
| `fre_502d_no_waiver` | [FRE 502(d)][fre-502] | `Production subject to FRE 502(d) order` | `Per section 502(d) of the company handbook, please RSVP.` |
| `bates_number` | [ABA Model Rule 3.4(c)][rule-3.4], Sedona | `ACME0000123` | `Order ID 0000123 was shipped yesterday.` |
| `privilege_log` | [FRCP 26(b)(5)(A)][frcp-26] | `Privilege Log Entry #14 — withheld for AC privilege` | `The application log shows 14 errors today.` |
| `clawback_notice` | [FRE 502(b)][fre-502] | `Clawback Notice under FRE 502(b)` | `Please send a notice of departure two weeks in advance.` |

### Category 5 — State-bar disciplinary identifiers

Covered above in Category 3. The state-bar numbers are kept with
the broader identifier pack because the regex shapes are tightly
coupled (same `\b...\d{N,M}\b` anchoring style) and a maintainer
updating one usually wants visibility on the others.

State formats verified against:

- California — 5-7 digits; [CA State Bar Member Records][ca-mem]
- New York — 7 digits; NY Judiciary Law §468-a
- Texas — 8 digits; Tex. Gov't Code §81.114
- Florida — 6 or 7 digits; Rule 1-3.2, Rules Regulating The Florida Bar

These four states cover ~45% of U.S. attorneys by headcount. Other
states (IL, PA, OH, GA) use varied formats and are intentionally
left to tenant `custom_patterns` — adding them to the preset would
multiply false-positive risk without proportional value.

### Category 6 — NDA / arbitration markers

Source: [`dlp_legal_nda.go`](../../services/gateway/internal/infrastructure/middleware/dlp_legal_nda.go)

NDAs are contractual confidentiality, not [ABA Model Rule 1.6][rule-1.6]
privilege. They are included in the preset because [ABA Formal
Opinion 512][aba-512] §III.B specifically flags GAI-tool inputs
that may breach a client's flow-down confidentiality obligations.

| Class | Rule | Positive example | Negative |
|---|---|---|---|
| `nda_subject` | [ABA Model Rule 1.6(c)][rule-1.6] | `Subject to NDA — diligence room only` | `This memo is subject to revision after the review.` |
| `mnda_dated` | [ABA Formal Op. 512][aba-512] | `Mutual Non-Disclosure Agreement dated January 1, 2025` | `We had a mutual understanding about the deadline.` |
| `confidentiality_agreement` | [ABA Formal Op. 512][aba-512] | `Confidentiality Agreement dated 2024-08-12` | `We have an unwritten confidentiality understanding.` |
| `confidential_information_designation` | NDA template §1 | `Confidential Information of the Disclosing Party` | `This is confidential information about our roadmap.` |
| `arbitration_clause` | 9 U.S.C. §§1-16 (Federal Arbitration Act) | `binding arbitration administered by JAMS` | `Binding decisions are made by the steering committee.` |
| `choice_of_law_clause` | Restatement (Second) of Contracts §178 | `governed by the laws of the State of Delaware` | `The team is governed by the engineering OKRs.` |

## What this preset deliberately does NOT do

- **Does not redact attorney names.** Names are first-class
  identifiers but the firm — not the gateway — decides whether
  the LLM should see them. Use `custom_patterns` JSONB on the
  tenant row to opt in per-attorney.
- **Does not claim exhaustiveness.** Litigation language varies
  by jurisdiction, firm template lineage, and practice area. The
  preset covers high-recall markers; tenants add lower-frequency
  patterns via `custom_patterns`.
- **Does not default to `block`.** Default is `mask` for the
  reasons stated above. The tenant can change this in the admin
  UI; the audit row will reflect the change.
- **Does not encode jurisdictional privilege analyses.** State
  privilege law varies (e.g., the Upjohn test for corporate
  attorney-client privilege, the work-product doctrine's
  treatment of dual-purpose documents). The preset is a signal
  layer, not a legal-reasoning engine.

## Verifying the preset

Every pattern in this document has a positive and a negative
behavior test in
[`dlp_legal_test.go`](../../services/gateway/internal/infrastructure/middleware/dlp_legal_test.go)
and
[`dlp_legal_cases_test.go`](../../services/gateway/internal/infrastructure/middleware/dlp_legal_cases_test.go).
Run:

```bash
cd services/gateway
go test ./internal/infrastructure/middleware/ -run TestLegal -v
```

A failing negative test indicates a new false positive; a failing
positive test indicates the regex no longer covers the legend
shape. Both block CI on the legal-preset path.
