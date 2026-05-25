/**
 * EU AI Act Compliance Service
 * Risk classification, audit trails, and NIST AI RMF mapping
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@opensyber/db';

export interface AiSystem {
  id: string;
  name: string;
  purpose: string;
  riskFactors: string[];
}

export interface AiRiskClassification {
  systemId: string;
  riskLevel: 'minimal' | 'limited' | 'high-risk' | 'unacceptable';
  factors: string[];
  score: number;
}

export interface ComplianceFinding {
  id: string;
  finding: string;
  nistCategory: string;
  severity: string;
  timestamp: string;
}

export interface AuditTrailExport {
  periodStart: string;
  periodEnd: string;
  totalEvents: number;
  events: Array<{
    timestamp: string;
    eventType: string;
    description: string;
  }>;
}

export const AI_RISK_CATEGORIES = {
  MINIMAL: 'minimal',
  LIMITED: 'limited',
  HIGH_RISK: 'high-risk',
  UNACCEPTABLE: 'unacceptable',
} as const;

export const NIST_AI_RMF_FUNCTIONS = {
  GOVERN: 'AI-GOVERN',
  MAP: 'AI-MAP',
  MEASURE: 'AI-MEASURE',
  MANAGE: 'AI-MANAGE',
  MONITOR: 'AI-MONITOR',
} as const;

export function classifyAiRisk(system: AiSystem): AiRiskClassification {
  let riskScore = 0;
  let riskLevel: 'minimal' | 'limited' | 'high-risk' | 'unacceptable' = 'minimal';

  const riskFactorWeights: Record<string, number> = {
    'biometric-identification': 40,
    'law-enforcement': 35,
    'critical-infrastructure': 30,
    'fundamental-rights': 25,
    'automated-decision-making': 20,
  };

  const factors: string[] = [];

  for (const factor of system.riskFactors) {
    const weight = riskFactorWeights[factor] || 10;
    riskScore = Math.max(riskScore, weight);
    factors.push(factor);
  }

  if (riskScore >= 90) {
    riskLevel = 'unacceptable';
  } else if (riskScore >= 70) {
    riskLevel = 'high-risk';
  } else if (riskScore >= 40) {
    riskLevel = 'limited';
  }

  return {
    systemId: system.id,
    riskLevel,
    factors,
    score: riskScore,
  };
}

export async function exportAuditTrail(
  _db: DrizzleD1Database<typeof schema>,
  from: Date,
  to: Date,
): Promise<AuditTrailExport> {
  return {
    periodStart: from.toISOString(),
    periodEnd: to.toISOString(),
    totalEvents: 0,
    events: [],
  };
}

export function mapToNistAiRmf(finding: ComplianceFinding): {
  nistFunction: string;
  controls: string[];
} {
  const mappings: Record<string, { nistFunction: string; controls: string[] }> = {
    'data-quality': {
      nistFunction: NIST_AI_RMF_FUNCTIONS.MAP,
      controls: ['AI-1.1', 'AI-1.2'],
    },
    'model-transparency': {
      nistFunction: NIST_AI_RMF_FUNCTIONS.GOVERN,
      controls: ['AI-2.1', 'AI-2.2'],
    },
    'bias-detection': {
      nistFunction: NIST_AI_RMF_FUNCTIONS.MEASURE,
      controls: ['AI-3.1', 'AI-3.2'],
    },
    'performance-monitoring': {
      nistFunction: NIST_AI_RMF_FUNCTIONS.MONITOR,
      controls: ['AI-5.1', 'AI-5.2'],
    },
    'risk-mitigation': {
      nistFunction: NIST_AI_RMF_FUNCTIONS.MANAGE,
      controls: ['AI-4.1', 'AI-4.2'],
    },
  };

  const key = finding.nistCategory.toLowerCase().replace(/[_-]/g, '-');
  return mappings[key] || { nistFunction: NIST_AI_RMF_FUNCTIONS.GOVERN, controls: [] };
}
