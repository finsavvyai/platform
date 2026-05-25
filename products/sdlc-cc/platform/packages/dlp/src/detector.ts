/**
 * Fast PII Detector.
 *
 * Deterministic regex-based PII detection that runs in sub-millisecond
 * time for common PII types: emails, phone numbers, SSNs, credit cards,
 * IP addresses, and dates of birth.
 *
 * Port of services/dlp/app/services/fast_pii_detector.py.
 */

import {
  DLPConfig,
  DEFAULT_DLP_CONFIG,
  PIIMatch,
  PIIType,
  ScanResult,
} from './types';

interface PatternDef {
  piiType: PIIType;
  pattern: RegExp;
  confidence: number;
  validator?: 'luhn' | 'ip_range';
}

/** Compiled regex patterns for each PII type. */
const PII_PATTERNS: PatternDef[] = [
  {
    piiType: PIIType.EMAIL,
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    confidence: 0.95,
  },
  {
    piiType: PIIType.PHONE,
    pattern:
      /\b(?:\+1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    confidence: 0.9,
  },
  {
    piiType: PIIType.SSN,
    pattern: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    confidence: 0.95,
  },
  {
    piiType: PIIType.CREDIT_CARD,
    pattern:
      /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,4}\b/g,
    confidence: 0.9,
    validator: 'luhn',
  },
  {
    piiType: PIIType.IP_ADDRESS,
    pattern:
      /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    confidence: 0.85,
    validator: 'ip_range',
  },
  {
    piiType: PIIType.DOB,
    pattern:
      /\b(?:DOB|Date of Birth|Born|Birthday|D\.O\.B\.?)[:\s]+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
    confidence: 0.9,
  },
];

/**
 * Signals that indicate ambiguous entities requiring NER/LLM.
 * If present, `canHandle` returns false.
 */
const AMBIGUITY_SIGNALS =
  /(?:(?:name|called|known as)\s+\w+|(?:lives?\s+(?:in|at|on))|(?:passport\s+(?:number|no\.?|#))|(?:driver'?s?\s+licen[sc]e))/i;

/** Validate a number string using the Luhn algorithm. */
export function luhnCheck(numberStr: string): boolean {
  const digits = numberStr.replace(/\D/g, '').split('').map(Number);
  if (digits.length < 13) return false;

  let checksum = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    if ((digits.length - 1 - i) % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    checksum += digit;
  }
  return checksum % 10 === 0;
}

/** Check that an IP is not a common non-PII address. */
export function validateIpRange(ip: string): boolean {
  const nonPiiPrefixes = ['0.', '127.', '255.', '224.'];
  return !nonPiiPrefixes.some((prefix) => ip.startsWith(prefix));
}

/**
 * Sub-millisecond PII detector using compiled regex patterns.
 *
 * Use as a fast-path before expensive LLM/ML-based detection.
 * Only handles well-structured, deterministic PII formats.
 */
export class FastPIIDetector {
  private readonly config: DLPConfig;

  constructor(config: Partial<DLPConfig> = {}) {
    this.config = { ...DEFAULT_DLP_CONFIG, ...config };
  }

  /**
   * Check if all PII in the text can be handled by regex alone.
   * Returns false if text contains ambiguous entities that need NER/LLM.
   */
  canHandle(text: string): boolean {
    if (!this.config.enabled) return false;
    return !AMBIGUITY_SIGNALS.test(text);
  }

  /** Detect PII in text using compiled regex patterns. */
  detect(text: string): PIIMatch[] {
    if (!this.config.enabled) return [];

    const matches: PIIMatch[] = [];

    for (const def of PII_PATTERNS) {
      def.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;

      while ((m = def.pattern.exec(text)) !== null) {
        const matchedText = m[0];
        let confidence = def.confidence;

        if (def.validator === 'luhn') {
          if (!luhnCheck(matchedText)) continue;
          confidence = 0.95;
        } else if (def.validator === 'ip_range') {
          if (!validateIpRange(matchedText)) continue;
        }

        if (confidence < this.config.confidenceThreshold) continue;

        matches.push({
          piiType: def.piiType,
          start: m.index,
          end: m.index + matchedText.length,
          matchedText,
          confidence,
          redactedLabel: `[REDACTED_${def.piiType}]`,
        });
      }
    }

    matches.sort((a, b) => a.start - b.start);
    return matches;
  }

  /** Detect PII and return a full ScanResult. */
  scan(text: string): ScanResult {
    const startTime = performance.now();
    const matches = this.detect(text);
    const scanTimeUs = (performance.now() - startTime) * 1000;

    const detectedTypes = [...new Set(matches.map((m) => m.piiType))];

    return {
      originalText: text,
      matches,
      matchCount: matches.length,
      detectedTypes,
      scanTimeUs,
    };
  }
}
