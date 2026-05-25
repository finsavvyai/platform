import { Globe, Cpu, MessageSquare, ClipboardList, Layers, Scale } from 'lucide-react'
import { type TrustSectionData } from './securityData'

export const complianceSections: TrustSectionData[] = [
  {
    icon: Globe,
    title: 'List Coverage',
    items: [
      'OFAC SDN, Consolidated, and Sectoral Sanctions lists (United States).',
      'UN Security Council Consolidated List.',
      'EU Consolidated Financial Sanctions List.',
      'UK HM Treasury / OFSI Consolidated List.',
      'Additional lists: DFAT (Australia), SECO (Switzerland), MAS (Singapore), and more.',
      'Lists are updated within minutes of publication by source authorities.',
      'All list sources are verified against official government endpoints.',
    ],
  },
  {
    icon: Cpu,
    title: 'Matching Methodology',
    items: [
      'Multi-layer matching engine. In production: Exact, Fuzzy (Levenshtein + Jaro-Winkler), Phonetic (Soundex + Metaphone), and Token-based. In active rollout: Embedding (vector similarity) and Graph-based layers.',
      'Weighted scoring model produces a confidence score from 0 to 100 for each potential match.',
      'Configurable thresholds per list, per entity type, and per risk policy.',
      'Deterministic and semantic matching run in parallel for both speed and accuracy.',
    ],
  },
  {
    icon: MessageSquare,
    title: 'Explainability',
    items: [
      'Every match result includes: confidence score, matched list and entry, matched fields, and a human-readable explanation.',
      'Explanation text describes which matching layers contributed and why.',
      'Match results are structured for direct inclusion in SAR/STR filings and audit reports.',
    ],
  },
  {
    icon: ClipboardList,
    title: 'Auditability',
    items: [
      'Complete screening history retained per configurable retention policy.',
      'Immutable audit logs for all screening decisions, including analyst actions and escalations.',
      'Decision traceability: every alert links back to the original screening request, match result, and resolution.',
      'Export-ready audit reports in CSV and PDF formats.',
    ],
  },
  {
    icon: Layers,
    title: 'Role in AML/KYC Stack',
    items: [
      'AMLIQ is a sanctions screening layer. It does not replace full KYC onboarding, transaction monitoring, or compliance case management.',
      'Designed to integrate via API into existing compliance workflows.',
      'Screening results should be reviewed by qualified compliance personnel before final disposition.',
      'Escalation to compliance officers is expected for matches above configured thresholds.',
    ],
  },
  {
    icon: Scale,
    title: 'Regulatory Alignment',
    items: [
      'Aligned with FATF Recommendations on targeted financial sanctions.',
      'Supports obligations under the 4th and 5th EU Anti-Money Laundering Directives (AMLD).',
      'Designed to assist compliance with the Bank Secrecy Act (BSA) and USA PATRIOT Act requirements.',
      'Regular review of methodology against evolving regulatory guidance.',
    ],
  },
]
