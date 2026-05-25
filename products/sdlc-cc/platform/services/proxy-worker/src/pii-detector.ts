/**
 * PII Detection Module
 *
 * Detects and redacts personally identifiable information (PII) from text.
 * Supports 12+ PII types with regex-based pattern matching.
 *
 * Week 2 Day 1 Implementation
 */

export interface PIIMatch {
  type: PIIType;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface PIIDetectionResult {
  text: string;
  matches: PIIMatch[];
  redactedText: string;
  redactionCount: number;
}

export enum PIIType {
  SSN = 'SSN',
  CREDIT_CARD = 'CREDIT_CARD',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  IP_ADDRESS = 'IP_ADDRESS',
  API_KEY = 'API_KEY',
  AWS_KEY = 'AWS_KEY',
  POSTAL_CODE = 'POSTAL_CODE',
  PASSPORT = 'PASSPORT',
  DRIVER_LICENSE = 'DRIVER_LICENSE',
  BANK_ACCOUNT = 'BANK_ACCOUNT',
  ROUTING_NUMBER = 'ROUTING_NUMBER',
}

/**
 * PII Detection Patterns
 * Each pattern includes regex, validation function, and confidence score
 */
const PII_PATTERNS: Array<{
  type: PIIType;
  pattern: RegExp;
  validate?: (match: string) => boolean;
  confidence: number;
}> = [
  // Bank Routing Numbers (9 digits) - Check BEFORE SSN to avoid conflicts
  {
    type: PIIType.ROUTING_NUMBER,
    pattern: /\b\d{9}\b/g,
    validate: (match: string) => {
      // ABA routing number checksum validation
      const digits = match.split('').map(Number);
      const checksum =
        3 * (digits[0] + digits[3] + digits[6]) +
        7 * (digits[1] + digits[4] + digits[7]) +
        (digits[2] + digits[5] + digits[8]);

      return checksum % 10 === 0;
    },
    confidence: 0.85, // Lower confidence due to potential overlap with other 9-digit numbers
  },

  // SSN: 123-45-6789 or 123456789 (with dashes/spaces preferred)
  {
    type: PIIType.SSN,
    pattern: /\b\d{3}[-\s]\d{2}[-\s]\d{4}\b/g,
    validate: (match: string) => {
      const digits = match.replace(/\D/g, '');
      // SSN shouldn't start with 000, 666, or 900-999
      const area = parseInt(digits.substring(0, 3));
      return area > 0 && area !== 666 && area < 900;
    },
    confidence: 0.95,
  },

  // Credit Cards: Visa, MasterCard, Amex, Discover
  {
    type: PIIType.CREDIT_CARD,
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    validate: (match: string) => {
      const digits = match.replace(/\D/g, '');

      // Length check (13-19 digits)
      if (digits.length < 13 || digits.length > 19) {
        return false;
      }

      // Luhn algorithm validation
      let sum = 0;
      let isEven = false;
      for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i]);
        if (isEven) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        isEven = !isEven;
      }
      return sum % 10 === 0;
    },
    confidence: 0.98,
  },

  // Email addresses
  {
    type: PIIType.EMAIL,
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    validate: (match: string) => {
      // Basic email validation
      const parts = match.split('@');
      return parts.length === 2 && parts[0].length > 0 && parts[1].includes('.');
    },
    confidence: 0.99,
  },

  // Phone numbers: +1-234-567-8900, (234) 567-8900, 234.567.8900
  {
    type: PIIType.PHONE,
    pattern: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    validate: (match: string) => {
      const digits = match.replace(/\D/g, '');
      return digits.length === 10 || digits.length === 11;
    },
    confidence: 0.90,
  },

  // IP Addresses (IPv4)
  {
    type: PIIType.IP_ADDRESS,
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    validate: (match: string) => {
      // Exclude common non-PII IPs
      const excludeList = ['0.0.0.0', '127.0.0.1', '255.255.255.255'];
      return !excludeList.includes(match) && !match.startsWith('192.168.');
    },
    confidence: 0.85,
  },

  // API Keys (generic patterns)
  {
    type: PIIType.API_KEY,
    pattern: /\b(?:api[_-]?key|apikey|api[_-]?secret)[_\s:=-]*([a-zA-Z0-9_\-]{20,})\b/gi,
    confidence: 0.92,
  },

  // AWS Access Keys
  {
    type: PIIType.AWS_KEY,
    pattern: /\b(AKIA[0-9A-Z]{16})\b/g,
    confidence: 0.99,
  },

  // US Postal Codes: 12345 or 12345-6789
  {
    type: PIIType.POSTAL_CODE,
    pattern: /\b\d{5}(?:-\d{4})?\b/g,
    validate: (match: string) => {
      // Exclude common non-postal numbers
      const num = parseInt(match);
      return num >= 501 && num <= 99950;
    },
    confidence: 0.75,
  },

  // Passport Numbers (US format)
  {
    type: PIIType.PASSPORT,
    pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
    confidence: 0.80,
  },

  // Driver's License (varies by state, generic pattern)
  {
    type: PIIType.DRIVER_LICENSE,
    pattern: /\b[A-Z]{1,2}\d{5,8}\b/g,
    confidence: 0.70,
  },

  // Bank Account Numbers (10-17 digits, exclude 9-digit routing numbers)
  {
    type: PIIType.BANK_ACCOUNT,
    pattern: /\b\d{10,17}\b/g,
    validate: (match: string) => {
      // Must be at least 10 digits (not 9, which is routing number)
      return match.length >= 10 && match.length <= 17;
    },
    confidence: 0.65,
  },
];

/**
 * Detect PII in text
 */
export function detectPII(text: string): PIIMatch[] {
  const matches: PIIMatch[] = [];

  for (const pattern of PII_PATTERNS) {
    pattern.pattern.lastIndex = 0; // Reset regex state
    let match: RegExpExecArray | null;

    while ((match = pattern.pattern.exec(text)) !== null) {
      const value = match[0];

      // Apply validation function if provided
      if (pattern.validate && !pattern.validate(value)) {
        continue;
      }

      matches.push({
        type: pattern.type,
        value,
        start: match.index,
        end: match.index + value.length,
        confidence: pattern.confidence,
      });
    }
  }

  // Sort by position for proper redaction
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Redact PII from text
 */
export function redactPII(text: string, detectedPII?: PIIMatch[]): PIIDetectionResult {
  const matches = detectedPII || detectPII(text);

  if (matches.length === 0) {
    return {
      text,
      matches: [],
      redactedText: text,
      redactionCount: 0,
    };
  }

  // Build redacted text by replacing matches with placeholders
  let redactedText = '';
  let lastIndex = 0;

  for (const match of matches) {
    // Add text before the match
    redactedText += text.substring(lastIndex, match.start);

    // Add redaction placeholder
    redactedText += `[${match.type}_REDACTED]`;

    lastIndex = match.end;
  }

  // Add remaining text
  redactedText += text.substring(lastIndex);

  return {
    text,
    matches,
    redactedText,
    redactionCount: matches.length,
  };
}

/**
 * Detect and redact PII in JSON objects
 * Recursively scans all string values
 */
export function redactPIIInObject(obj: unknown): { redacted: unknown; matches: PIIMatch[] } {
  const allMatches: PIIMatch[] = [];

  const redact = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const result = redactPII(value);
      allMatches.push(...result.matches);
      return result.redactedText;
    } else if (Array.isArray(value)) {
      return value.map(redact);
    } else if (value !== null && typeof value === 'object') {
      const redacted: Record<string, unknown> = {};
      for (const key in value as Record<string, unknown>) {
        redacted[key] = redact((value as Record<string, unknown>)[key]);
      }
      return redacted;
    }
    return value;
  };

  const redacted = redact(obj);
  return { redacted, matches: allMatches };
}

/**
 * Get redaction summary for logging
 */
export function getRedactionSummary(matches: PIIMatch[]): Record<PIIType, number> {
  const summary: Record<string, number> = {};

  for (const match of matches) {
    summary[match.type] = (summary[match.type] || 0) + 1;
  }

  return summary as Record<PIIType, number>;
}

/**
 * Check if text contains PII
 */
export function containsPII(text: string): boolean {
  return detectPII(text).length > 0;
}

/**
 * Get PII types found in text
 */
export function getPIITypes(text: string): PIIType[] {
  const matches = detectPII(text);
  const types = new Set(matches.map(m => m.type));
  return Array.from(types);
}
