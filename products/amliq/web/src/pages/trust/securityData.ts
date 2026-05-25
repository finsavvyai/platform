import { Shield, Lock, Eye, Key, Server, FileCheck } from 'lucide-react'
import { type LucideIcon } from 'lucide-react'

export interface TrustSectionData {
  icon: LucideIcon
  title: string
  items: string[]
}

export const securitySections: TrustSectionData[] = [
  {
    icon: Server,
    title: 'Infrastructure',
    items: [
      'Deployed on Cloudflare’s global edge network. Cloudflare’s platform itself holds ISO 27001, SOC 2 Type II, and PCI DSS attestations; AMLIQ’s own SOC 2 Type II audit is in progress (see Compliance Posture below).',
      'All traffic is served exclusively over TLS 1.3 with HSTS and modern cipher suites.',
      'Customer data is logically isolated per tenant across the application, cache, and database layers.',
      'Dependencies and container images are scanned continuously for known CVEs, with automated patching for the web, API, and worker layers.',
    ],
  },
  {
    icon: Eye,
    title: 'Data Handling',
    items: [
      'AMLIQ processes screening queries against public sanctions, PEP, and adverse-media lists. No end-user PII is persisted beyond the screening session unless the customer explicitly enables audit retention.',
      'Screening logs default to a 90-day retention window and are configurable per tenant.',
      'EU and US data residency options are available on request; customer-controlled regions are on the roadmap.',
      'Sensitive fields (identifiers, free-text notes) are encrypted at the application layer before being written to storage.',
    ],
  },
  {
    icon: Key,
    title: 'Access Control',
    items: [
      'Role-based access control (RBAC) with predefined roles: Admin, Analyst, and Viewer.',
      'API keys are scoped per environment (production, sandbox) and support configurable rate limits and IP allow-lists.',
      'Authentication, configuration changes, and screening events are written to an append-only audit trail with timestamp, actor, and source IP.',
      'Multi-factor authentication (MFA) is available for all dashboard users. SAML SSO for Enterprise plans is in development — contact sales@amliq.finance for early access.',
    ],
  },
  {
    icon: FileCheck,
    title: 'Compliance Posture',
    items: [
      'Security program designed against the SOC 2 Trust Services Criteria; formal SOC 2 Type II attestation is in progress.',
      'GDPR-aligned data processing, including support for data subject access, correction, and deletion requests.',
      'Data Processing Addendum (DPA) and Standard Contractual Clauses (SCCs) available for EU customers on request.',
      'Periodic internal security reviews and third-party penetration testing are planned ahead of the commercial launch.',
    ],
  },
  {
    icon: Shield,
    title: 'Incident Response',
    items: [
      'Documented incident response runbook with defined severity levels, on-call rotation, and escalation paths.',
      'Responsible disclosure program for security researchers — please report findings to security@amliq.finance.',
      'In the event of a confirmed data breach, affected customers will be notified without undue delay and, where applicable, within 72 hours in line with GDPR Article 33.',
    ],
  },
  {
    icon: Lock,
    title: 'Contact',
    items: [
      'Security inquiries or vulnerability reports: security@amliq.finance',
      'DPA requests and compliance documentation: compliance@amliq.finance',
    ],
  },
]
