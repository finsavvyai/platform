/**
 * DLP Condition Evaluator - Evaluates rule conditions against data
 */

import {
  DLPCondition,
  DLPRule,
  DLPViolation,
  DataClassification,
  ProcessedData,
  CollectedEvidence,
} from '../../types/dlp';
import crypto from 'crypto';

export function extractText(data: ProcessedData | string | unknown): string {
  if (typeof data === 'string') {
    return data;
  } else if (typeof data === 'object' && data !== null && 'text' in data) {
    return String((data as ProcessedData).text);
  } else if (typeof data === 'object') {
    return JSON.stringify(data);
  }
  return String(data);
}

export function calculateEntropy(text: string): number {
  const freq = new Map<string, number>();

  for (const char of text) {
    freq.set(char, (freq.get(char) || 0) + 1);
  }

  let entropy = 0;
  const length = text.length;

  for (const count of freq.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

export function evaluateRegexCondition(condition: DLPCondition, data: ProcessedData): boolean {
  const regex = new RegExp(String(condition.value), condition.parameters?.flags || 'gi');
  const text = extractText(data);
  return regex.test(text);
}

export function evaluateKeywordCondition(condition: DLPCondition, data: ProcessedData): boolean {
  const text = extractText(data).toLowerCase();
  const conditionValue = condition.value;
  const keywords = Array.isArray(conditionValue)
    ? conditionValue.map(String)
    : [String(conditionValue)];

  return keywords.some(keyword =>
    text.includes(keyword.toLowerCase())
  );
}

export function evaluateMLCondition(condition: DLPCondition, data: ProcessedData): boolean {
  // Placeholder for ML model evaluation
  return false;
}

export function evaluateEntropyCondition(condition: DLPCondition, data: ProcessedData): boolean {
  const text = extractText(data);
  const entropy = calculateEntropy(text);
  return entropy > (condition.parameters?.threshold ?? 4.5);
}

export function evaluateFormatCondition(condition: DLPCondition, data: ProcessedData): boolean {
  const text = extractText(data);

  switch (String(condition.value)) {
    case 'CREDIT_CARD':
      return /^\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}$/.test(text.replace(/\s/g, ''));
    case 'SSN':
      return /^\d{3}-\d{2}-\d{4}$/.test(text);
    case 'EMAIL':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
    case 'PHONE':
      return /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/.test(text);
    default:
      return false;
  }
}

export async function evaluateCondition(
  condition: DLPCondition,
  data: ProcessedData,
  classification: DataClassification
): Promise<boolean> {
  switch (condition.type) {
    case 'REGEX':
      return evaluateRegexCondition(condition, data);
    case 'KEYWORD':
      return evaluateKeywordCondition(condition, data);
    case 'ML_MODEL':
      return evaluateMLCondition(condition, data);
    case 'ENTROPY':
      return evaluateEntropyCondition(condition, data);
    case 'FORMAT':
      return evaluateFormatCondition(condition, data);
    default:
      return false;
  }
}

export async function evaluateRule(
  rule: DLPRule,
  data: ProcessedData,
  classification: DataClassification
): Promise<boolean> {
  if (rule.dataTypes && !rule.dataTypes.includes(classification.type)) {
    return false;
  }

  for (const condition of rule.conditions) {
    const result = await evaluateCondition(condition, data, classification);
    if (result) {
      return true;
    }
  }

  return false;
}

export async function collectEvidence(rule: DLPRule, data: ProcessedData): Promise<CollectedEvidence> {
  const evidence: CollectedEvidence = {
    ruleId: rule.id,
    timestamp: new Date().toISOString(),
    dataHash: crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex'),
    matches: []
  };

  for (const condition of rule.conditions) {
    if (condition.type === 'REGEX') {
      const pattern = String(condition.value);
      const regex = new RegExp(pattern, condition.parameters?.flags || 'gi');
      const text = extractText(data);
      const matches = text.match(regex);

      if (matches) {
        evidence.matches.push({
          type: 'regex',
          pattern,
          matches: matches.slice(0, 10)
        });
      }
    }
  }

  return evidence;
}

export async function evaluateRules(
  rules: Map<string, DLPRule>,
  data: ProcessedData,
  classification: DataClassification
): Promise<DLPViolation[]> {
  const violations: DLPViolation[] = [];

  for (const rule of rules.values()) {
    if (await evaluateRule(rule, data, classification)) {
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        severity: rule.severity,
        description: rule.description,
        detectedAt: new Date().toISOString(),
        evidence: await collectEvidence(rule, data)
      });
    }
  }

  return violations;
}
