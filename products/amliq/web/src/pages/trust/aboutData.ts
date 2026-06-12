import { Target, Lightbulb, Zap, Mail, User, Flag, MapPin } from 'lucide-react'
import { type TrustSectionData } from './securityData'

export const aboutSections: TrustSectionData[] = [
  {
    icon: User,
    title: 'Who Builds AMLIQ',
    items: [
      'Founder & engineer: Shachar Solomon — background in payments and platform engineering. Personal site: https://shacharsolomon.dev.',
      'AMLIQ is currently a small, founder-led team. We are not hiding behind a generic "team" page — when we make our first commercial hires, they will be named here.',
      'Investor or partnership inquiries: founders@amliq.finance.',
    ],
  },
  {
    icon: Flag,
    title: 'Stage',
    items: [
      'Pre-seed, bootstrapped. No outside capital raised to date.',
      'In design-partner early access — we are onboarding a hand-picked set of fintechs and PSPs before opening general availability.',
      'Open about what is shipped vs. in progress: see /changelog for what landed, /benchmarks for accuracy methodology, and /status for uptime.',
    ],
  },
  {
    icon: MapPin,
    title: 'Where Your Data Lives',
    items: [
      'AMLIQ runs on Cloudflare’s global edge network. Static and edge traffic is routed to the nearest region; the application database is hosted in a primary region with encrypted backups.',
      'EU and US data-residency options are available to design-partner customers on request. Fully customer-pinned regions are on the roadmap.',
      'Screening payloads are processed in-memory and not persisted unless the customer explicitly enables audit retention (default retention: 90 days, configurable).',
      'Sub-processor list, DPA, and SCCs are public at /dpa. GDPR/CCPA data-subject requests: compliance@amliq.finance.',
    ],
  },
  {
    icon: Target,
    title: 'Why We Exist',
    items: [
      'Legacy sanctions screening tools are expensive, opaque, and slow to adapt.',
      'Financial institutions deserve infrastructure they can inspect, configure, and trust.',
      'We built AMLIQ to give compliance teams modern tooling without vendor lock-in or black-box scoring.',
    ],
  },
  {
    icon: Zap,
    title: 'What We Do',
    items: [
      'Real-time sanctions screening across OFAC, UN, EU, UK, and additional global watchlists.',
      'Explainable matching: every result includes a confidence score and a human-readable explanation of why a match was flagged.',
      'Real-time API responses for single-entity screening (sub-50ms design target).',
      'Batch screening for onboarding and periodic review workflows.',
    ],
  },
  {
    icon: Lightbulb,
    title: 'Values',
    items: [
      'Transparency: Matching logic is documented and explainable. No hidden algorithms.',
      'Accuracy: Multi-layer matching engine (four layers in production, semantic and network in rollout) minimizes both false positives and false negatives.',
      'Security: Data protection and tenant isolation are foundational, not afterthoughts.',
      'Simplicity: Clean API, clear documentation, fast integration.',
    ],
  },
  {
    icon: Mail,
    title: 'Contact',
    items: [
      'General inquiries: info@amliq.finance',
      'Security: security@amliq.finance',
      'Compliance documentation requests: compliance@amliq.finance',
    ],
  },
]
