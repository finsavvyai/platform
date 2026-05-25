export interface StackRow {
  label: string
  value: string
}

export interface TimelineWeek {
  label: string
  title: string
  milestones: string[]
}

export interface DeliverableRow {
  artifact: string
  targetWeek: string
}

export interface RiskRow {
  risk: string
  mitigation: string
  owner: string
}

// Capabilities PushCI ships today and would activate for Norlys on Day 1.
export const stackDelivered: StackRow[] = [
  { label: 'Repositories', value: '10 Java Maven repos (in scope for pilot)' },
  { label: 'Languages', value: 'Java, plus 32 others (Maven, Gradle, Ant detection)' },
  { label: 'Build detection', value: 'Jenkinsfile, Maven, Gradle, Ant, and AWS CodePipeline manifests detected on init' },
  { label: 'Encryption', value: 'AES-256-GCM at rest, TLS 1.3 in transit, SHA-256 release checksums' },
  { label: 'Audit log', value: 'Auth events and admin actions persisted as DB rows; tamper-evident chain available' },
  { label: 'Identity', value: 'SAML SSO and SCIM v2 endpoints shipped today (api/src/saml-routes.ts, api/src/scim.ts)' },
  { label: 'Tenant', value: 'Single-tenant control plane on Cloudflare Workers (region pin scoped for pilot Wk 1)' },
]

// Items requiring integration work during the pilot. Not pre-built features.
export const stackPilotScope: StackRow[] = [
  {
    label: 'Gerrit integration',
    value:
      'Gerrit REST client + Verified / Code-Review label write-back built in pilot Week 2',
  },
  {
    label: 'Jenkins live bridge',
    value:
      'Jenkinsfile import (declarative + scripted) and live job poll bridge built in pilot Week 3',
  },
  {
    label: 'AWS CodePipeline bridge',
    value: 'Live status bridge for designated CodePipeline pipelines built in pilot Week 4',
  },
  {
    label: 'Secrets',
    value:
      'BYO secret store — Vault, AWS Secrets Manager, or Azure Key Vault adapter built in pilot Week 2',
  },
  {
    label: 'Identity (Azure AD)',
    value: 'Azure AD SCIM provisioning configured against Norlys tenant in pilot Week 1–2',
  },
  {
    label: 'EU residency',
    value: 'D1 location_hint = "weur" set on the pilot tenant in pilot Week 1',
  },
  {
    label: 'DORA metrics',
    value: 'Lead-time and change-failure dashboard built on pilot data in Weeks 8-10',
  },
  {
    label: 'SOC 2 evidence',
    value: 'One-click evidence export pack draft delivered in Week 11',
  },
  {
    label: 'Tenant DNS',
    value: 'pushci.norlys.dk subdomain provisioned by Norlys IT in Week 1',
  },
]

export const timeline: TimelineWeek[] = [
  {
    label: 'Week 1',
    title: 'Kickoff & discovery',
    milestones: [
      'Meet Norlys DevEx team, map current CI estate',
      'Inventory the 10 Maven repos (modules, dependencies, Jenkins jobs)',
      'Document Gerrit project topology and review labels',
      'Obtain AWS IAM read-only access for CodePipeline poll bridge',
      'Provision pilot tenant on pushci.norlys.dk and lock EU-West region',
    ],
  },
  {
    label: 'Weeks 2-3',
    title: 'Integration',
    milestones: [
      'Wire Gerrit webhook into PushCI and verify label write-back',
      'Import 3 pilot Jenkins jobs via pushci import jenkins',
      'Generate .pushci.yml from pom.xml for all 10 repos',
      'Build Vault adapter for Maven credentials (Week 2 deliverable)',
      'Integrate Azure AD SAML SSO and scope SCIM provisioning design',
    ],
  },
  {
    label: 'Weeks 4-6',
    title: 'Parallel run',
    milestones: [
      'Run PushCI and Jenkins side-by-side on the same commits',
      'Compare build times, reliability, and developer feedback weekly',
      'Tune caching strategies and runner sizing',
      'Enable AI diagnose / heal on 2 flagship repositories',
    ],
  },
  {
    label: 'Weeks 7-9',
    title: 'Production cutover',
    milestones: [
      'Cut 3 lower-risk repos to PushCI as primary build',
      'Observe for 2 weeks with documented rollback path to Jenkins',
      'Cut remaining 7 repos with per-repo owner sign-off',
    ],
  },
  {
    label: 'Weeks 10-12',
    title: 'Governance & handover',
    milestones: [
      'Deliver SOC 2 evidence pack draft for Norlys review',
      'Build DORA metrics dashboard from collected pilot data',
      'Run training workshops for the Norlys DevEx team',
      'Joint retrospective and contract proposal for production scope',
    ],
  },
]

export const successCriteria: string[] = [
  '50% or better reduction in average build time for pilot repositories',
  '90% or better developer satisfaction rating on post-pilot survey',
  'Zero P1 incidents during cutover of the 10 repos',
  'SOC 2 evidence pack draft delivered and accepted by Norlys security',
  'If 50% build-time reduction is not achieved by Week 6, Norlys may terminate the pilot per SOW §6 — fees attributable to Weeks 7–12 are refunded; Weeks 1–6 (paid 50% upfront) are retained',
]

export const deliverables: DeliverableRow[] = [
  { artifact: 'Signed Statement of Work', targetWeek: 'Pre-Week 1' },
  { artifact: 'Kickoff deck and integration runbook', targetWeek: 'Week 1' },
  { artifact: 'Weekly status update (Friday)', targetWeek: 'Weeks 1-12' },
  { artifact: '30-day review document', targetWeek: 'Week 4' },
  { artifact: '60-day review document', targetWeek: 'Week 8' },
  { artifact: 'SOC 2 evidence pack draft', targetWeek: 'Week 11' },
  { artifact: '90-day retrospective and production contract proposal', targetWeek: 'Week 12' },
]

export const risks: RiskRow[] = [
  {
    risk: 'EU data residency hard-binding slips',
    mitigation: 'D1 location-hint enforced in Week 1; verified via region-probe smoke test',
    owner: 'PushCI platform',
  },
  {
    risk: 'Vault adapter delivery delayed past Week 2',
    mitigation: 'Fallback to AWS Secrets Manager adapter (lower integration risk) for pilot scope',
    owner: 'PushCI integration',
  },
  {
    risk: 'Gerrit webhook reliability at Norlys scale',
    mitigation: 'Backoff + REST polling fallback already shipped; load-tested in Week 3',
    owner: 'PushCI platform',
  },
  {
    risk: 'Jenkinsfile edge cases in Norlys-specific scripted pipelines',
    mitigation: 'Manual translation playbook + side-by-side validation in Weeks 4-6',
    owner: 'Joint',
  },
  {
    risk: 'AI diagnose / heal false positives erode trust',
    mitigation: 'Suggestions surfaced as advisory only; opt-in per repo; reviewed in Week 6',
    owner: 'PushCI AI',
  },
  {
    risk: 'Production cutover requires rollback',
    mitigation: 'Jenkins kept warm for 14 days post-cutover; one-command revert documented',
    owner: 'Norlys DevEx',
  },
]
