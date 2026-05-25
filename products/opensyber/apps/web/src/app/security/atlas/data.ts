/** MITRE ATLAS + OWASP LLM Top 10 coverage data. */

export type CoverageLevel = 'Full' | 'Partial' | 'Roadmap';

export interface AtlasTechnique {
  id: string;
  name: string;
  coverage: CoverageLevel;
  how: string;
}

export interface AtlasTactic {
  tactic: string;
  tacticId: string;
  techniques: AtlasTechnique[];
}

export interface OwaspEntry {
  id: string;
  name: string;
  coverage: CoverageLevel;
  how: string;
}

export const atlasTactics: AtlasTactic[] = [
  {
    tactic: 'Reconnaissance',
    tacticId: 'AML.T0000',
    techniques: [
      { id: 'AML.T0000.000', name: 'Search for victim\'s ML artifacts', coverage: 'Partial', how: 'Skill marketplace audit logs detect enumeration of published artifacts.' },
      { id: 'AML.T0000.001', name: 'Search for publicly available models', coverage: 'Partial', how: 'Supply chain scan flags abnormal model-registry access patterns.' },
    ],
  },
  {
    tactic: 'Resource Development',
    tacticId: 'AML.T0001',
    techniques: [
      { id: 'AML.T0001.000', name: 'Acquire ML artifacts', coverage: 'Full', how: 'Skill verification with SBOM analysis and signature checks on every install.' },
      { id: 'AML.T0001.001', name: 'Poison training data', coverage: 'Roadmap', how: 'Planned: data-provenance attestation and integrity hashing.' },
    ],
  },
  {
    tactic: 'Initial Access',
    tacticId: 'AML.T0010',
    techniques: [
      { id: 'AML.T0010', name: 'ML supply chain compromise', coverage: 'Full', how: '4-stage skill audit: static analysis, sandbox execution, signature verification, runtime monitoring.' },
      { id: 'AML.T0015', name: 'Prompt injection', coverage: 'Full', how: '5-layer detection: regex → embedding similarity → LLM judge → output schema → tool anomaly.' },
      { id: 'AML.T0016', name: 'Indirect prompt injection', coverage: 'Full', how: 'Instruction-file scanning and fetched-content analysis before LLM ingestion.' },
    ],
  },
  {
    tactic: 'Execution',
    tacticId: 'AML.T0020',
    techniques: [
      { id: 'AML.T0020', name: 'Misuse of ML tool', coverage: 'Full', how: 'Tool-call baseline with per-agent argument anomaly detection over 30-day window.' },
      { id: 'AML.T0044', name: 'Full model access', coverage: 'Partial', how: 'Egress control on model weights; download volume monitoring.' },
    ],
  },
  {
    tactic: 'Persistence',
    tacticId: 'AML.T0030',
    techniques: [
      { id: 'AML.T0030', name: 'Backdoor ML model', coverage: 'Partial', how: 'Output divergence monitoring detects behavioral drift from known-good baseline.' },
    ],
  },
  {
    tactic: 'Exfiltration',
    tacticId: 'AML.T0024',
    techniques: [
      { id: 'AML.T0024', name: 'Exfiltration via ML API', coverage: 'Full', how: 'Output size monitoring and context-window correlation flag oversized responses.' },
      { id: 'AML.T0025', name: 'Exfiltration via cyber means', coverage: 'Full', how: 'DNS tunnel, SNI lookalike, pastebin, and slow-and-low beaconing detection.' },
    ],
  },
  {
    tactic: 'Impact',
    tacticId: 'AML.T0029',
    techniques: [
      { id: 'AML.T0029', name: 'Denial of ML service', coverage: 'Full', how: 'Per-agent rate limiting and cost-bomb protection with circuit breakers.' },
      { id: 'AML.T0034', name: 'Cost harvesting', coverage: 'Full', how: 'Token budget enforcement with anomalous spend alerts and auto-suspend.' },
    ],
  },
];

export const owaspLlmTop10: OwaspEntry[] = [
  { id: 'LLM01', name: 'Prompt Injection', coverage: 'Full', how: '5-layer prompt injection pipeline.' },
  { id: 'LLM02', name: 'Insecure Output Handling', coverage: 'Full', how: 'Output schema validation and sanitization.' },
  { id: 'LLM03', name: 'Training Data Poisoning', coverage: 'Roadmap', how: 'Planned: data provenance attestation.' },
  { id: 'LLM04', name: 'Model Denial of Service', coverage: 'Full', how: 'Rate limiting and cost-bomb protection.' },
  { id: 'LLM05', name: 'Supply Chain Vulnerabilities', coverage: 'Full', how: '4-stage skill audit with SBOM.' },
  { id: 'LLM06', name: 'Sensitive Information Disclosure', coverage: 'Full', how: 'Egress monitoring and credential isolation.' },
  { id: 'LLM07', name: 'Insecure Plugin Design', coverage: 'Full', how: 'Skill sandbox with permission scoping.' },
  { id: 'LLM08', name: 'Excessive Agency', coverage: 'Full', how: 'Tool-call baselining and argument anomaly detection.' },
  { id: 'LLM09', name: 'Overreliance', coverage: 'Partial', how: 'Output validation against expected schemas.' },
  { id: 'LLM10', name: 'Model Theft', coverage: 'Full', how: 'Egress control on model artifacts and weights.' },
];

/** Summary stats derived from the data. */
export function computeStats() {
  const all = atlasTactics.flatMap((t) => t.techniques);
  const full = all.filter((t) => t.coverage === 'Full').length;
  const partial = all.filter((t) => t.coverage === 'Partial').length;
  const roadmap = all.filter((t) => t.coverage === 'Roadmap').length;
  return { total: all.length, full, partial, roadmap };
}
