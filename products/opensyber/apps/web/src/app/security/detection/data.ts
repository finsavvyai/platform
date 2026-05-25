/** Detection page data — 5-layer model and egress techniques. */
import type { LucideIcon } from 'lucide-react';
import {
  Regex, Fingerprint, Brain, FileCheck, Activity,
  Globe, Lock, Timer, Cloud, Maximize2, Radio,
} from 'lucide-react';

export interface DetectionLayer {
  number: number;
  name: string;
  icon: LucideIcon;
  latency: string;
  description: string;
  detail: string;
}

export interface EgressTechnique {
  icon: LucideIcon;
  name: string;
  description: string;
}

export const layers: DetectionLayer[] = [
  {
    number: 1,
    name: 'Pattern Matching',
    icon: Regex,
    latency: '<1ms',
    description: 'Regex and heuristic rules catch known-bad patterns.',
    detail:
      'Base64-encoded system overrides, "ignore previous instructions" variants, and known jailbreak templates. Sub-millisecond, high recall for known attacks.',
  },
  {
    number: 2,
    name: 'Embedding Similarity',
    icon: Fingerprint,
    latency: '~5ms',
    description: 'Incoming prompts compared against known-bad embedding corpus.',
    detail:
      'Catches paraphrased and multilingual variants of known attacks that regex misses. Vector similarity search against a curated corpus of adversarial prompts.',
  },
  {
    number: 3,
    name: 'LLM Judge',
    icon: Brain,
    latency: '~80ms',
    description: 'Fixed system-prompt LLM evaluates whether the input is adversarial.',
    detail:
      'Catches novel attacks that have no pattern or embedding match. The judge LLM runs with a locked system prompt and cannot be influenced by the input it evaluates.',
  },
  {
    number: 4,
    name: 'Output Validation',
    icon: FileCheck,
    latency: '~2ms',
    description: 'Response checked against expected schema.',
    detail:
      'Detects when an attack succeeds by checking if the output contains code, scripts, or shell commands when JSON was expected. Schema violations trigger alert and response suppression.',
  },
  {
    number: 5,
    name: 'Behavioral Baseline',
    icon: Activity,
    latency: '30-day window',
    description: 'Per-agent tool-call patterns and egress destinations tracked over time.',
    detail:
      'This is where real agent attacks are caught. A read_file to a path the agent has never touched, an http_post whose body length suddenly tracks context window size, or a new outbound domain. Any deviation from established normal is flagged.',
  },
];

export const egressTechniques: EgressTechnique[] = [
  { icon: Globe, name: 'DNS Tunneling', description: 'TXT record encoding to exfiltrate data through DNS queries.' },
  { icon: Lock, name: 'TLS SNI Lookalike Domains', description: 'Domains that mimic legitimate services in the TLS Server Name Indication field.' },
  { icon: Timer, name: 'Slow-and-Low Beaconing', description: 'Low-frequency, low-volume exfiltration designed to fly under rate-based detection.' },
  { icon: Cloud, name: 'Legitimate SaaS API Abuse', description: 'Data exfiltration via pastebin, image upload, or other public SaaS endpoints.' },
  { icon: Maximize2, name: 'Context-Window-Sized POST Bodies', description: 'HTTP POST bodies whose size correlates with the LLM context window, indicating bulk extraction.' },
  { icon: Radio, name: 'New Domain Detection', description: 'Outbound connections to domains not seen in the agent\'s 30-day behavioral history.' },
];

export const latencyStats = {
  p50: '12ms',
  p95: '89ms',
  p99: '340ms',
  layerBreakdown: 'Layers 1-2 handle 94% of events. Layer 3 is invoked only on ambiguous inputs.',
};

export const falsePositiveRate =
  'Median 0.3 FP per agent per day on the reference workload. We measure and publish this because detection without precision is noise.';
