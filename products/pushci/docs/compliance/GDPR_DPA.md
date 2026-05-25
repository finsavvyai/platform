# Data Processing Addendum (DPA)

**Version:** 1.0 — 2026-04-11
**License:** CC-BY-4.0 (template)
**Template purpose:** This is PushCI's standard Data Processing Addendum
template for enterprise customers subject to the EU General Data Protection
Regulation (Regulation (EU) 2016/679) ("**GDPR**") and the UK GDPR. It is
made available for negotiation on a per-customer basis and becomes binding
only once executed by both parties.

> **Note to reviewers (remove before signing):** This template is provided
> in good faith but does **not** constitute legal advice. It should be
> reviewed by qualified EU counsel before execution. Square brackets
> indicate fields to be completed per engagement.

---

## 1. Parties

This Data Processing Addendum ("**DPA**") is entered into between:

- **[Customer legal name]** ("**Controller**"), with registered office at
  [Customer address], represented by [Customer signatory]; and
- **PushCI ApS** ("**Processor**" or "**PushCI**"), with registered office
  at [PushCI registered address], represented by [PushCI signatory].

each a "**Party**" and together the "**Parties**".

This DPA forms part of, and is governed by, the Master Services Agreement
("**MSA**") signed by the Parties on [date] (the "**Agreement**") for the
provision of the PushCI Platform (the "**Services**"). In the event of a
conflict between this DPA and the MSA, this DPA prevails with respect to
the processing of Personal Data.

## 2. Definitions

Capitalised terms used but not defined in this DPA have the meanings
assigned to them in the GDPR.

- "**Personal Data**" has the meaning given in Article 4(1) GDPR.
- "**Processing**" has the meaning given in Article 4(2) GDPR.
- "**Controller**" and "**Processor**" have the meanings given in
  Article 4(7) and 4(8) GDPR respectively.
- "**Sub-processor**" means any Processor engaged by PushCI to carry out
  specific processing activities on behalf of the Controller.
- "**Data Subject**" means an identified or identifiable natural person to
  whom Personal Data relates.
- "**Standard Contractual Clauses**" or "**SCCs**" means the standard
  contractual clauses for the transfer of personal data to third countries
  pursuant to Commission Implementing Decision (EU) 2021/914.
- "**EEA**" means the European Economic Area.

## 3. Subject matter, duration & nature of processing

### 3.1 Subject matter
The subject matter of the processing is the operation of the PushCI
Platform, a continuous integration / continuous delivery ("**CI/CD**")
service that runs automated tests, builds, and deployments on behalf of
the Controller.

### 3.2 Duration
Processing will continue for the term of the Agreement. Upon termination,
PushCI will delete or return Personal Data in accordance with Section 11.

### 3.3 Nature & purpose
PushCI processes Personal Data only to:

1. Authenticate Controller personnel via OAuth (GitHub, GitLab, Bitbucket,
   Google, Microsoft) and issue short-lived JWTs.
2. Associate CI/CD runs, audit events, and billing usage with the acting
   user.
3. Send transactional emails (pipeline failures, release approvals) to
   users who have opted in.
4. Respond to Data Subject rights requests and legal obligations.

### 3.4 Categories of Data Subjects
- Developers and DevOps engineers employed or contracted by the Controller.
- Administrators and billing contacts designated by the Controller.
- End-users whose source repositories are processed by the Services.

### 3.5 Categories of Personal Data
- **Identity data:** OAuth provider sub, user login / username, email.
- **Professional data:** team memberships, role assignments, project
  access grants.
- **Technical data:** IP address (rate limiting only, not stored beyond
  2 minutes), user agent strings on login, OAuth access tokens.
- **Usage data:** pipeline run history, audit log actor attribution,
  feature usage counters.

PushCI processes **no** special-category data (Article 9 GDPR) and **no**
criminal-conviction data (Article 10 GDPR).

## 4. Obligations of PushCI as Processor

PushCI shall:

- (a) Process Personal Data only on documented instructions from the
  Controller, including with regard to transfers of Personal Data to a
  third country.
- (b) Ensure that persons authorised to process the Personal Data have
  committed themselves to confidentiality or are under an appropriate
  statutory obligation of confidentiality.
- (c) Take all measures required pursuant to Article 32 GDPR (security of
  processing). See Section 7 and cross-reference `SOC2_CONTROLS.md`.
- (d) Respect the conditions for engaging another processor (Section 6).
- (e) Taking into account the nature of the processing, assist the
  Controller by appropriate technical and organisational measures for the
  fulfilment of the Controller's obligation to respond to requests for
  exercising the Data Subject's rights. See Section 9.
- (f) Assist the Controller in ensuring compliance with the obligations
  pursuant to Articles 32 to 36 GDPR (security, breach notification, DPIA,
  prior consultation).
- (g) At the choice of the Controller, delete or return all Personal Data
  to the Controller after the end of the provision of Services relating
  to processing, and delete existing copies unless EU or Member State law
  requires storage of the Personal Data.
- (h) Make available to the Controller all information necessary to
  demonstrate compliance with the obligations laid down in Article 28 GDPR
  and allow for and contribute to audits, including inspections, conducted
  by the Controller or another auditor mandated by the Controller.

## 5. Obligations of the Controller

The Controller warrants that it has obtained all necessary consents and
has a lawful basis under Article 6 GDPR for the processing that it
instructs PushCI to carry out, and that its instructions are lawful.

## 6. Sub-processors

### 6.1 General authorisation
The Controller grants PushCI a general authorisation to engage
Sub-processors for the provision of the Services, subject to the
requirements of this Section 6 and Article 28(2) GDPR.

### 6.2 List of Sub-processors (as of the effective date)

| Sub-processor              | Role                                          | Location                | Legal basis for transfer |
|----------------------------|-----------------------------------------------|-------------------------|--------------------------|
| **Cloudflare, Inc.**       | Compute (Workers), database (D1), KV, R2, CDN | EU (FRA/AMS), global    | SCCs + Cloudflare DPA     |
| **Anthropic, PBC**         | LLM inference for AI features (Claude Haiku)  | US                      | SCCs                      |
| **Lemon Squeezy, Inc. (d/b/a Lemon Squeezy)**           | Subscription billing, invoicing               | US (EU data processed in Ireland) | SCCs             |
| **Lemon Squeezy, LLC**     | Alternative billing / checkout                | US                      | SCCs                      |
| **Resend**                 | Transactional email                           | US / EU                 | SCCs                      |
| **GitHub, Inc.**           | OAuth identity provider (for users who login via GitHub) | US          | SCCs                      |
| **GitLab, Inc.**           | OAuth identity provider (optional)            | US                      | SCCs                      |
| **Atlassian Pty Ltd**      | Bitbucket OAuth identity provider (optional)  | AU / US                 | SCCs                      |
| **PagerDuty, Inc.**        | Incident on-call (internal)                   | US                      | SCCs                      |

The up-to-date list is maintained at
`https://pushci.dev/legal/subprocessors` and surfaced in the compliance
evidence pack.

### 6.3 Change notification
PushCI will give the Controller at least **30 days** prior written notice
(via email or the in-app notification centre) of any intended changes
concerning the addition or replacement of Sub-processors. The Controller
may object to the appointment of a new Sub-processor on reasonable grounds
within 14 days of notice; if the objection cannot be resolved, the
Controller may terminate the affected Services without penalty.

## 7. Security measures

PushCI implements the technical and organisational measures set out in the
control matrix at [`SOC2_CONTROLS.md`](./SOC2_CONTROLS.md) and summarised
below. These measures are reviewed at least annually and updated in line
with the state of the art.

### 7.1 Access control
- Multi-factor-capable OAuth identity providers only (GitHub, GitLab,
  Bitbucket, Google, Microsoft, LinkedIn, Facebook).
- Per-project RBAC with seven distinct roles.
- Separation of duties enforced for production deployments.

### 7.2 Encryption
- TLS 1.2+ enforced in transit; HSTS always-on.
- AES-256-GCM for CLI secret vault.
- Cloudflare platform encryption at rest for D1, KV, R2.

### 7.3 Pseudonymisation
- User references in `audit_logs` are provider `sub` strings (opaque),
  not emails or real names.

### 7.4 Integrity
- Hash-chained audit log (see `audit-immutable.ts`) detects tampering
  of any audit record.

### 7.5 Availability & resilience
- Global anycast via Cloudflare.
- Daily audit chain verification sweep.

### 7.6 Testing
- 465+ Go + TS tests, run on every commit.
- Annual third-party penetration test.

## 8. International transfers

Where processing involves the transfer of Personal Data outside the EEA
to a country not benefiting from an adequacy decision, the Parties agree
that the **EU Standard Contractual Clauses (Module 2: Controller to
Processor)** as set out in Commission Implementing Decision (EU) 2021/914
shall apply and are hereby incorporated by reference. Where PushCI
engages a Sub-processor outside the EEA, PushCI shall enter into the
applicable SCCs (**Module 3: Processor to Processor**) with that
Sub-processor.

For transfers to the United Kingdom, the Parties agree to apply the
**UK International Data Transfer Addendum** (IDTA) issued by the UK
Information Commissioner's Office.

Docking clause: Section 7 of the SCCs applies and new parties may accede
to the SCCs by completing the relevant annexes.

## 9. Data Subject rights

### 9.1 Assistance
Taking into account the nature of the processing, PushCI will assist the
Controller in fulfilling requests from Data Subjects to exercise their
rights under Chapter III of the GDPR (Articles 12–22).

### 9.2 Procedures
PushCI provides the following technical endpoints that the Controller may
use to fulfil Data Subject requests:

- **Access (Article 15) / Portability (Article 20):**
  `GET /api/compliance/gdpr/export/:userSub`
- **Erasure (Article 17):**
  `DELETE /api/compliance/gdpr/erase/:userSub` — replaces `actor_login`
  with `"ERASED"` in `audit_logs` while preserving `actor_sub` to
  maintain referential integrity for audit purposes.
- **Rectification (Article 16):** via dashboard profile settings or
  support request.

Where a request is received directly by PushCI, PushCI will forward it
to the Controller without undue delay and will not respond to the Data
Subject except on the Controller's instructions.

## 10. Personal data breach notification

PushCI will notify the Controller **without undue delay and in any case
within 48 hours** of becoming aware of a Personal Data breach affecting
the Controller's Personal Data. The notification will include, to the
extent known at the time:

- the nature of the breach, categories and approximate number of Data
  Subjects and records concerned;
- the likely consequences;
- measures taken or proposed to address the breach and mitigate its
  possible adverse effects;
- the name and contact details of PushCI's point of contact.

## 11. Deletion or return of Personal Data

Upon expiry or termination of the Agreement, the Controller may within
**30 days** request that PushCI delete or return all Personal Data. After
that period, PushCI will delete the Personal Data except where required
to retain it by EU or Member State law (including its SOC 2 audit
obligations, in which case the audit log retention period applies —
7 years by default, configurable via `/api/compliance/retention-policy`).

## 12. Audit rights

The Controller may audit PushCI's compliance with this DPA at most once
per 12-month period (except following a Personal Data breach), upon at
least 30 days' prior written notice, during normal business hours, and
subject to reasonable confidentiality obligations.

PushCI may satisfy the Controller's audit rights by providing:

- A current SOC 2 Type II report (once issued) or equivalent third-party
  audit;
- A signed evidence pack from `GET /api/compliance/soc2/evidence`;
- Responses to the Controller's security questionnaires.

## 13. Liability

The liability of each Party under or in connection with this DPA
(whether in contract, tort, or otherwise) shall be subject to the
exclusions and limitations of liability set out in the MSA.

## 14. Governing law and jurisdiction

This DPA is governed by the laws of the **Kingdom of Denmark**, without
regard to its conflict of laws principles. The Parties submit to the
exclusive jurisdiction of the courts of **Copenhagen, Denmark**, for any
disputes arising out of or in connection with this DPA, without prejudice
to any mandatory forum available to Data Subjects under Article 79 GDPR.

## 15. Miscellaneous

- **Entire agreement.** This DPA and the MSA constitute the entire
  agreement between the Parties regarding the processing of Personal Data.
- **Amendments.** Amendments to this DPA must be in writing and signed by
  both Parties.
- **Severability.** If any provision is found unenforceable, the rest
  remain in force.
- **Order of precedence.** In case of conflict: SCCs > this DPA > MSA.

---

## Annex I — Details of processing

(a) **List of Parties:** as set out in Section 1.
(b) **Description of transfer:** as set out in Section 3.
(c) **Competent supervisory authority:** the Danish Data Protection
Authority (*Datatilsynet*), unless the Controller is established in a
different EEA Member State, in which case the supervisory authority of
that Member State applies.

## Annex II — Technical and organisational measures

See [`SOC2_CONTROLS.md`](./SOC2_CONTROLS.md) — in particular controls
CC6.1–CC6.8, CC7.1–CC7.5, C1.1–C1.2.

## Annex III — List of Sub-processors

See Section 6.2, updated at `https://pushci.dev/legal/subprocessors`.

---

**Signed for and on behalf of [Customer legal name]:**

Name: ______________________________________
Title: ______________________________________
Date: ______________________________________
Signature: __________________________________

**Signed for and on behalf of PushCI ApS:**

Name: ______________________________________
Title: ______________________________________
Date: ______________________________________
Signature: __________________________________
